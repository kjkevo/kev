-- CrowdPlay: Trivia schema (MVP)
-- Design principles:
--   1. No accounts. Host gets a host_secret (bearer token) when creating a room.
--      Players get a client_token when joining. Both are opaque UUIDs stored
--      client-side (localStorage) — good enough for a single bar-night session,
--      no auth flow to slow down drunk thumbs at 11pm.
--   2. Correct answers NEVER go to the client until the host reveals them.
--      All scoring happens in submit_answer() using the server clock, so
--      nobody can open devtools and read the answer key or fake their speed.
--   3. Realtime sync rides on Postgres changes to rooms/players/answers —
--      one source of truth, no separate broadcast channel to keep in sync.

create extension if not exists pgcrypto;

-- ---------- Content ----------

create table public.question_packs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  created_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.question_packs(id) on delete cascade,
  order_index int not null,
  prompt text not null,
  choices jsonb not null,
  correct_index smallint not null check (correct_index between 0 and 3),
  time_limit_seconds int not null default 15,
  unique (pack_id, order_index)
);

-- Public view: everything EXCEPT the answer key. This is what clients query.
create view public.questions_public as
  select id, pack_id, order_index, prompt, choices, time_limit_seconds
  from public.questions;

-- ---------- Live game state ----------

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_secret uuid not null default gen_random_uuid(),
  pack_id uuid not null references public.question_packs(id),
  phase text not null default 'lobby'
    check (phase in ('lobby','question','reveal','leaderboard','final')),
  current_question_index int not null default 0,
  question_started_at timestamptz,
  revealed_correct_index smallint,
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  client_token uuid not null default gen_random_uuid(),
  nickname text not null,
  score int not null default 0,
  joined_at timestamptz not null default now(),
  unique (room_id, nickname)
);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  player_id uuid not null references public.players(id) on delete cascade,
  choice_index smallint not null,
  correct boolean not null,
  points_awarded int not null default 0,
  answered_at timestamptz not null default now(),
  unique (question_id, player_id)
);

-- ---------- RLS: read is open, ALL writes go through the RPCs below ----------

alter table public.question_packs enable row level security;
alter table public.questions enable row level security;
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.answers enable row level security;

create policy "packs readable" on public.question_packs for select using (true);
create policy "rooms readable" on public.rooms for select using (true);
create policy "players readable" on public.players for select using (true);
create policy "answers readable" on public.answers for select using (true);
-- Note: no policy on public.questions itself (only questions_public view, which
-- inherits the querying role's access to the underlying table's SELECT grant —
-- see grants below). Nobody gets direct SELECT on public.questions.

grant select on public.questions_public to anon, authenticated;
revoke all on public.questions from anon, authenticated;

-- ---------- RPCs (SECURITY DEFINER = only these can write game state) ----------

create function public.create_room(p_pack_id uuid)
returns table(room_id uuid, code text, host_secret uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_room public.rooms;
begin
  loop
    v_code := upper(substr(md5(random()::text), 1, 5));
    begin
      insert into public.rooms (code, pack_id) values (v_code, p_pack_id)
      returning * into v_room;
      exit;
    exception when unique_violation then
      -- code collision, try again
    end;
  end loop;
  return query select v_room.id, v_room.code, v_room.host_secret;
end;
$$;

create function public.join_room(p_code text, p_nickname text)
returns table(player_id uuid, client_token uuid, room_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
  v_player public.players;
begin
  select * into v_room from public.rooms where code = upper(p_code);
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.phase <> 'lobby' then
    raise exception 'ROOM_ALREADY_STARTED';
  end if;
  if length(trim(p_nickname)) < 1 or length(p_nickname) > 20 then
    raise exception 'INVALID_NICKNAME';
  end if;

  insert into public.players (room_id, nickname) values (v_room.id, trim(p_nickname))
  returning * into v_player;

  return query select v_player.id, v_player.client_token, v_player.room_id;
exception when unique_violation then
  raise exception 'NICKNAME_TAKEN';
end;
$$;

create function public.start_room(p_room_id uuid, p_host_secret uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.rooms
    set phase = 'question',
        current_question_index = 0,
        question_started_at = now(),
        revealed_correct_index = null
    where id = p_room_id and host_secret = p_host_secret;
  if not found then
    raise exception 'NOT_AUTHORIZED_OR_NOT_FOUND';
  end if;
end;
$$;

create function public.advance_phase(p_room_id uuid, p_host_secret uuid, p_action text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
  v_correct smallint;
  v_pack_size int;
begin
  select * into v_room from public.rooms
    where id = p_room_id and host_secret = p_host_secret
    for update;
  if not found then
    raise exception 'NOT_AUTHORIZED_OR_NOT_FOUND';
  end if;

  if p_action = 'reveal' then
    select correct_index into v_correct from public.questions
      where pack_id = v_room.pack_id and order_index = v_room.current_question_index;
    update public.rooms set phase = 'reveal', revealed_correct_index = v_correct
      where id = p_room_id;

  elsif p_action = 'leaderboard' then
    update public.rooms set phase = 'leaderboard' where id = p_room_id;

  elsif p_action = 'next_question' then
    select count(*) into v_pack_size from public.questions where pack_id = v_room.pack_id;
    if v_room.current_question_index + 1 >= v_pack_size then
      update public.rooms set phase = 'final' where id = p_room_id;
    else
      update public.rooms set
        phase = 'question',
        current_question_index = v_room.current_question_index + 1,
        question_started_at = now(),
        revealed_correct_index = null
      where id = p_room_id;
    end if;

  elsif p_action = 'end' then
    update public.rooms set phase = 'final' where id = p_room_id;

  else
    raise exception 'UNKNOWN_ACTION';
  end if;
end;
$$;

create function public.submit_answer(
  p_room_id uuid, p_player_id uuid, p_client_token uuid,
  p_question_id uuid, p_choice_index smallint
)
returns table(correct boolean, points_awarded int)
language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
  v_question public.questions;
  v_elapsed_ms int;
  v_correct boolean;
  v_points int;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.phase <> 'question' then raise exception 'NOT_ACCEPTING_ANSWERS'; end if;

  perform 1 from public.players
    where id = p_player_id and room_id = p_room_id and client_token = p_client_token;
  if not found then raise exception 'NOT_AUTHORIZED'; end if;

  select * into v_question from public.questions where id = p_question_id;
  if not found or v_question.pack_id <> v_room.pack_id
     or v_question.order_index <> v_room.current_question_index then
    raise exception 'STALE_QUESTION';
  end if;

  v_elapsed_ms := greatest(0, extract(epoch from (now() - v_room.question_started_at)) * 1000)::int;
  if v_elapsed_ms > (v_question.time_limit_seconds * 1000 + 1500) then
    raise exception 'TIME_EXPIRED';
  end if;

  v_correct := (p_choice_index = v_question.correct_index);
  v_points := 0;
  if v_correct then
    -- 500 base + up to 500 speed bonus, decaying to 0 at the time limit
    v_points := 500 + greatest(0, round(500 * (1 - v_elapsed_ms::numeric / (v_question.time_limit_seconds * 1000))))::int;
  end if;

  insert into public.answers (room_id, question_id, player_id, choice_index, correct, points_awarded)
    values (p_room_id, p_question_id, p_player_id, p_choice_index, v_correct, v_points)
    on conflict (question_id, player_id) do nothing;

  if not found then
    -- already answered this question; return their original result, don't rescore
    select a.correct, a.points_awarded into v_correct, v_points
      from public.answers a where a.question_id = p_question_id and a.player_id = p_player_id;
    return query select v_correct, v_points;
    return;
  end if;

  update public.players set score = score + v_points where id = p_player_id;

  return query select v_correct, v_points;
end;
$$;

grant execute on function
  public.create_room(uuid),
  public.join_room(text, text),
  public.start_room(uuid, uuid),
  public.advance_phase(uuid, uuid, text),
  public.submit_answer(uuid, uuid, uuid, uuid, smallint)
to anon, authenticated;

-- ---------- Realtime ----------

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.answers;
