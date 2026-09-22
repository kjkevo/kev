-- Base schema + autonomous game loop for Social Bingo, CrowdPlay's third
-- game. Same architecture as trivia and Family Feud: SECURITY DEFINER RPCs
-- are the only mutation path, the prompt pool lives in a locked-down table
-- (RLS enabled, zero policies), and a pg_cron ticker drives every phase
-- transition hands-off.
--
-- Gameplay: each player gets a personal 5x5 card (25 squares, center is a
-- free space) built from a shared pool of social/icebreaker prompts ("find
-- someone who...", "high five a stranger", etc). Marking is self-reported --
-- there's no way to verify someone actually did the thing, same as real
-- party bingo -- the fun is the excuse to talk to strangers, not enforcement.
-- First player to complete a row, column, or diagonal wins the round; the
-- room then cycles a few rounds (fresh cards each time) before wrapping up,
-- same "roller coaster" shape as trivia and feud.

-- ---------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------

create table public.bingo_prompts (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  active boolean not null default true
);

create table public.bingo_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  phase text not null default 'lobby'
    check (phase in ('lobby','playing','reveal','leaderboard','final')),
  created_at timestamptz not null default now(),
  starts_at timestamptz,
  phase_started_at timestamptz not null default now(),
  current_round_index int not null default 0,
  total_rounds int not null default 3,
  round_duration_seconds int not null default 300,
  winner_player_id uuid,
  winner_pattern text,
  retired boolean not null default false
);

create table public.bingo_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.bingo_rooms(id) on delete cascade,
  nickname text not null,
  client_token uuid not null default gen_random_uuid(),
  joined_at timestamptz not null default now(),
  card jsonb not null default '[]'::jsonb, -- [{"id": uuid|null, "text": string, "free": bool}, ...] length 25
  marked jsonb not null default '[]'::jsonb, -- [bool, ...] length 25, index-aligned with card
  score int not null default 0,
  bingo_at timestamptz,
  unique (room_id, nickname)
);

alter table public.bingo_rooms
  add constraint bingo_rooms_winner_player_fk
  foreign key (winner_player_id) references public.bingo_players(id);

alter table public.bingo_prompts enable row level security; -- locked: no policies
alter table public.bingo_rooms enable row level security;
alter table public.bingo_players enable row level security;

create policy "bingo_rooms readable" on public.bingo_rooms for select using (true);
create policy "bingo_players readable" on public.bingo_players for select using (true);

alter publication supabase_realtime add table public.bingo_rooms;
alter publication supabase_realtime add table public.bingo_players;

-- ---------------------------------------------------------------------
-- Card + win-check helpers
-- ---------------------------------------------------------------------

create or replace function public.random_bingo_card()
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_card jsonb := '[]'::jsonb;
  v_free_index constant int := 12;
  v_prompt record;
  i int := 0;
begin
  for v_prompt in (select id, text from public.bingo_prompts where active order by random() limit 24) loop
    if i = v_free_index then
      v_card := v_card || jsonb_build_object('id', null, 'text', 'Free space', 'free', true);
    end if;
    v_card := v_card || jsonb_build_object('id', v_prompt.id, 'text', v_prompt.text, 'free', false);
    i := i + 1;
  end loop;
  if jsonb_array_length(v_card) < 25 then
    v_card := v_card || jsonb_build_object('id', null, 'text', 'Free space', 'free', true);
  end if;
  return v_card;
end;
$function$;

create or replace function public.default_bingo_marked()
returns jsonb
language sql
immutable
as $$
  select jsonb_agg(gs = 12) from generate_series(0, 24) as gs;
$$;

create or replace function public.check_bingo_win(p_marked jsonb)
returns text
language plpgsql
immutable
as $function$
declare
  v_lines constant int[][] := array[
    array[0,1,2,3,4], array[5,6,7,8,9], array[10,11,12,13,14], array[15,16,17,18,19], array[20,21,22,23,24],
    array[0,5,10,15,20], array[1,6,11,16,21], array[2,7,12,17,22], array[3,8,13,18,23], array[4,9,14,19,24],
    array[0,6,12,18,24], array[4,8,12,16,20]
  ];
  v_names constant text[] := array[
    'row_0','row_1','row_2','row_3','row_4','col_0','col_1','col_2','col_3','col_4','diag_main','diag_anti'
  ];
  i int;
  j int;
  v_all_marked boolean;
begin
  for i in 1 .. array_length(v_lines, 1) loop
    v_all_marked := true;
    for j in 1 .. 5 loop
      if coalesce(p_marked ->> v_lines[i][j], 'false') <> 'true' then
        v_all_marked := false;
        exit;
      end if;
    end loop;
    if v_all_marked then
      return v_names[i];
    end if;
  end loop;
  return null;
end;
$function$;

-- ---------------------------------------------------------------------
-- Room lifecycle
-- ---------------------------------------------------------------------

create or replace function public.create_bingo_room(p_starts_at timestamptz default null)
returns table(room_id uuid, code text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_code text;
  v_room public.bingo_rooms;
begin
  loop
    v_code := upper(substr(md5(random()::text), 1, 5));
    begin
      insert into public.bingo_rooms (code, starts_at)
        values (v_code, p_starts_at)
        returning * into v_room;
      exit;
    exception when unique_violation then
    end;
  end loop;

  return query select v_room.id, v_room.code;
end;
$function$;

create or replace function public.start_bingo_round(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.bingo_rooms;
  v_player record;
begin
  select * into v_room from public.bingo_rooms where id = p_room_id for update;
  if not found then
    return;
  end if;

  for v_player in select id from public.bingo_players where room_id = p_room_id loop
    update public.bingo_players set
      card = public.random_bingo_card(),
      marked = public.default_bingo_marked(),
      bingo_at = null
      where id = v_player.id;
  end loop;

  update public.bingo_rooms set
    current_round_index = v_room.current_round_index + 1,
    winner_player_id = null,
    winner_pattern = null,
    phase = 'playing',
    phase_started_at = now()
    where id = p_room_id;
end;
$function$;

-- ---------------------------------------------------------------------
-- Player-facing RPCs
-- ---------------------------------------------------------------------

create or replace function public.join_bingo_room(p_code text, p_nickname text)
returns table(player_id uuid, client_token uuid, room_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.bingo_rooms;
  v_player public.bingo_players;
  v_existing_count int;
  v_card jsonb := '[]'::jsonb;
  v_marked jsonb := '[]'::jsonb;
begin
  select * into v_room from public.bingo_rooms where code = upper(p_code) for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if length(trim(p_nickname)) < 1 or length(p_nickname) > 30 then
    raise exception 'INVALID_NICKNAME';
  end if;

  select count(*) into v_existing_count from public.bingo_players bp where bp.room_id = v_room.id;
  if v_existing_count >= 50 then
    raise exception 'ROOM_FULL';
  end if;

  if v_room.phase = 'playing' then
    v_card := public.random_bingo_card();
    v_marked := public.default_bingo_marked();
  end if;

  insert into public.bingo_players (room_id, nickname, card, marked)
    values (v_room.id, trim(p_nickname), v_card, v_marked)
    returning * into v_player;

  return query select v_player.id, v_player.client_token, v_player.room_id;
exception when unique_violation then
  raise exception 'NICKNAME_TAKEN';
end;
$function$;

create or replace function public.mark_bingo_square(
  p_room_id uuid,
  p_player_id uuid,
  p_client_token uuid,
  p_index int
)
returns table(o_marked jsonb, o_won boolean, o_pattern text, o_phase text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.bingo_rooms;
  v_player public.bingo_players;
  v_new_marked jsonb;
  v_pattern text;
  v_is_free boolean;
begin
  select * into v_room from public.bingo_rooms where id = p_room_id for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.phase <> 'playing' then
    raise exception 'NOT_ACCEPTING_MARKS';
  end if;

  select * into v_player from public.bingo_players
    where id = p_player_id and room_id = p_room_id and client_token = p_client_token;
  if not found then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if jsonb_array_length(v_player.card) < 25 or p_index < 0 or p_index > 24 then
    raise exception 'NO_ACTIVE_CARD';
  end if;

  v_is_free := coalesce((v_player.card -> p_index ->> 'free')::boolean, false);
  if v_is_free then
    return query select v_player.marked, false, public.check_bingo_win(v_player.marked), v_room.phase;
    return;
  end if;

  v_new_marked := jsonb_set(
    v_player.marked,
    array[p_index::text],
    to_jsonb(not coalesce((v_player.marked ->> p_index)::boolean, false))
  );
  update public.bingo_players set marked = v_new_marked where id = p_player_id;

  v_pattern := public.check_bingo_win(v_new_marked);

  if v_pattern is not null and v_room.winner_player_id is null then
    update public.bingo_rooms set
      winner_player_id = p_player_id, winner_pattern = v_pattern, phase = 'reveal', phase_started_at = now()
      where id = p_room_id;
    update public.bingo_players set score = score + 100, bingo_at = now() where id = p_player_id;
    return query select v_new_marked, true, v_pattern, 'reveal'::text;
    return;
  end if;

  return query select v_new_marked, false, v_pattern, v_room.phase;
end;
$function$;

-- ---------------------------------------------------------------------
-- Autonomous ticker
-- ---------------------------------------------------------------------

create or replace function public.tick_bingo()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_reveal_dwell constant int := 8;
  v_leaderboard_dwell constant int := 8;
  v_final_dwell constant int := 20;
  v_lobby_boarding_seconds constant int := 20;
  v_room record;
begin
  for v_room in select * from public.bingo_rooms where phase <> 'final' or not retired loop

    if v_room.phase = 'lobby' and v_room.starts_at is not null and v_room.starts_at <= now() then
      perform public.start_bingo_round(v_room.id);

    elsif v_room.phase = 'playing' then
      if now() >= v_room.phase_started_at + make_interval(secs => v_room.round_duration_seconds) then
        -- Time ran out with nobody hitting bingo -- reveal with no winner.
        update public.bingo_rooms set phase = 'reveal', phase_started_at = now() where id = v_room.id;
      end if;

    elsif v_room.phase = 'reveal' then
      if now() >= v_room.phase_started_at + make_interval(secs => v_reveal_dwell) then
        update public.bingo_rooms set phase = 'leaderboard', phase_started_at = now() where id = v_room.id;
      end if;

    elsif v_room.phase = 'leaderboard' then
      if now() >= v_room.phase_started_at + make_interval(secs => v_leaderboard_dwell) then
        if v_room.current_round_index >= v_room.total_rounds then
          update public.bingo_rooms set phase = 'final', phase_started_at = now() where id = v_room.id;
        else
          perform public.start_bingo_round(v_room.id);
        end if;
      end if;

    elsif v_room.phase = 'final' and not v_room.retired then
      if now() >= v_room.phase_started_at + make_interval(secs => v_final_dwell) then
        update public.bingo_rooms set retired = true where id = v_room.id;
      end if;
    end if;

  end loop;

  if not exists (select 1 from public.bingo_rooms where not retired) then
    perform public.create_bingo_room(now() + make_interval(secs => v_lobby_boarding_seconds));
  end if;
end;
$function$;

revoke execute on function public.tick_bingo() from anon, authenticated, public;
revoke execute on function public.start_bingo_round(uuid) from anon, authenticated, public;
revoke execute on function public.create_bingo_room(timestamptz) from anon, authenticated, public;
revoke execute on function public.random_bingo_card() from anon, authenticated, public;
revoke execute on function public.default_bingo_marked() from anon, authenticated, public;
revoke execute on function public.check_bingo_win(jsonb) from anon, authenticated, public;

select cron.schedule('social_bingo_autonomous_tick', '1 second', 'select public.tick_bingo();');

-- ---------------------------------------------------------------------
-- Seed content -- original icebreaker/social prompts for a bar or event
-- setting, nothing that requires proof beyond the honor system.
-- ---------------------------------------------------------------------

insert into public.bingo_prompts (text) values
('Find someone wearing the same color as you'),
('Find someone who has the same first initial as you'),
('High five a stranger'),
('Find someone who has traveled outside the country this year'),
('Find someone who can name all their siblings in under 5 seconds'),
('Find someone born in the same season as you'),
('Get someone to teach you a word in another language'),
('Find someone who has met a celebrity'),
('Find someone who has the same phone case color as you'),
('Trade a fun fact with a stranger'),
('Find someone who has run a 5k or further'),
('Find someone who plays a musical instrument'),
('Find someone who has the same job title category as you'),
('Get a stranger to guess your age within 3 years'),
('Find someone who has a pet with a funny name'),
('Find someone who has been to a concert this year'),
('Find someone who can do a card trick or magic trick'),
('Find someone who has lived in 3 or more cities'),
("Find someone who's left-handed"),
('Get someone to tell you their go-to karaoke song'),
('Find someone wearing glasses'),
('Find someone who has never broken a bone'),
('Find someone who knows the bartender by name'),
('Find someone who has a tattoo they can describe'),
('Find someone who has the same favorite season as you'),
('Get a stranger to recommend you a show or movie'),
('Find someone who has been to this venue before'),
('Find someone who can whistle a tune'),
('Find someone who has a sibling with the same name as one of your friends'),
('Find someone celebrating something tonight'),
('Find someone who came here with more than 3 friends'),
('Get someone to do a group cheers with you'),
('Find someone who has the same favorite sports team as you'),
('Find someone who can name 3 U.S. presidents in a row'),
('Find someone who has a nickname'),
('Get a stranger to take a photo with you');
