-- Rebuilds trivia around real multi-device teams instead of solo play (or a
-- single device typing in cosmetic "teammate" name labels). As solo joiners
-- pile in, they're auto-bucketed into open teams of up to 4; anyone can
-- instead create a named team for friends to join directly. A self-made
-- team that never reaches 3 real members when the round starts gets folded
-- into the auto-team pool rather than playing undersized. Each question,
-- every teammate votes; whichever choice has the most votes among them when
-- the timer runs out is the team's answer -- no correctness feedback is
-- shown per question, only the full question-by-question recap and final
-- team standings once the game ends (so nobody can infer they got one wrong
-- from a stalled score mid-game).

-- ---------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  kind text not null default 'auto' check (kind in ('auto','self')),
  locked boolean not null default false,
  score int not null default 0,
  created_at timestamptz not null default now(),
  unique (room_id, name)
);

alter table public.players add column team_id uuid references public.teams(id);

-- Locked down like `questions` -- correctness must never reach a client
-- before the room is in its 'final' phase. Only get_final_recap() below can
-- read it, and only once that's true.
create table public.team_answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  choice_index smallint,
  correct boolean not null default false,
  points_awarded int not null default 0,
  vote_count int not null default 0,
  finalized_at timestamptz not null default now(),
  unique (team_id, question_id)
);

alter table public.teams enable row level security;
alter table public.team_answers enable row level security; -- locked: no policies

create policy "teams readable" on public.teams for select using (true);

alter publication supabase_realtime add table public.teams;

-- ---------------------------------------------------------------------
-- Team formation helpers
-- ---------------------------------------------------------------------

create or replace function public.auto_bucket_team(p_room_id uuid)
returns table(o_team_id uuid, o_team_name text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_found_id uuid;
  v_found_name text;
  v_next_num int;
  v_new_id uuid;
  v_new_name text;
begin
  select t.id, t.name into v_found_id, v_found_name
    from public.teams t
    where t.room_id = p_room_id and t.kind = 'auto' and not t.locked
      and (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null) < 4
    order by t.created_at asc
    limit 1
    for update of t;

  if v_found_id is not null then
    return query select v_found_id, v_found_name;
    return;
  end if;

  select count(*) + 1 into v_next_num from public.teams t where t.room_id = p_room_id and t.kind = 'auto';
  v_new_name := 'Team ' || v_next_num;
  insert into public.teams (room_id, name, kind) values (p_room_id, v_new_name, 'auto')
    returning id into v_new_id;

  return query select v_new_id, v_new_name;
end;
$function$;

-- ---------------------------------------------------------------------
-- Join flow: auto-bucket (default), join a named team by id, or create one
-- ---------------------------------------------------------------------

drop function if exists public.join_room(text, text, text[]);

create or replace function public.join_room(
  p_code text,
  p_nickname text,
  p_team_id uuid default null,
  p_new_team_name text default null
)
returns table(player_id uuid, client_token uuid, room_id uuid, team_id uuid, team_name text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.rooms;
  v_player public.players;
  v_team_id uuid;
  v_team_name text;
  v_member_count int;
  v_locked boolean;
begin
  select * into v_room from public.rooms where code = upper(p_code) for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if length(trim(p_nickname)) < 1 or length(p_nickname) > 30 then
    raise exception 'INVALID_NICKNAME';
  end if;

  if p_new_team_name is not null and length(trim(p_new_team_name)) > 0 then
    if length(trim(p_new_team_name)) > 30 then
      raise exception 'INVALID_TEAM_NAME';
    end if;
    if exists (select 1 from public.teams t where t.room_id = v_room.id and t.name = trim(p_new_team_name)) then
      raise exception 'TEAM_NAME_TAKEN';
    end if;
    insert into public.teams (room_id, name, kind) values (v_room.id, trim(p_new_team_name), 'self')
      returning id, name into v_team_id, v_team_name;

  elsif p_team_id is not null then
    select t.id, t.name, t.locked into v_team_id, v_team_name, v_locked
      from public.teams t where t.id = p_team_id and t.room_id = v_room.id for update;
    if v_team_id is null then
      raise exception 'TEAM_NOT_FOUND';
    end if;
    if v_locked then
      raise exception 'TEAM_LOCKED';
    end if;
    select count(*) into v_member_count from public.players pl
      where pl.team_id = v_team_id and pl.left_at is null;
    if v_member_count >= 4 then
      raise exception 'TEAM_FULL';
    end if;

  else
    select o_team_id, o_team_name into v_team_id, v_team_name from public.auto_bucket_team(v_room.id);
  end if;

  insert into public.players (room_id, nickname, team_id)
    values (v_room.id, trim(p_nickname), v_team_id)
    returning * into v_player;

  return query select v_player.id, v_player.client_token, v_player.room_id, v_team_id, v_team_name;
exception when unique_violation then
  raise exception 'NICKNAME_TAKEN';
end;
$function$;

-- ---------------------------------------------------------------------
-- Voting (replaces submit_answer -- no per-vote correctness is computed or
-- exposed anymore, that only happens at question-close, team-side)
-- ---------------------------------------------------------------------

drop function if exists public.submit_answer(uuid, uuid, uuid, uuid, smallint);

create or replace function public.cast_team_vote(
  p_room_id uuid,
  p_player_id uuid,
  p_client_token uuid,
  p_question_id uuid,
  p_choice_index smallint
)
returns table(o_recorded boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.rooms;
  v_expected_question_id uuid;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.phase <> 'question' then
    raise exception 'NOT_ACCEPTING_ANSWERS';
  end if;

  perform 1 from public.players pl
    where pl.id = p_player_id and pl.room_id = p_room_id and pl.client_token = p_client_token and pl.left_at is null;
  if not found then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select rq.question_id into v_expected_question_id from public.room_questions rq
    where rq.room_id = p_room_id and rq.order_index = v_room.current_question_index;
  if v_expected_question_id is null or v_expected_question_id <> p_question_id then
    raise exception 'STALE_QUESTION';
  end if;

  insert into public.answers (room_id, question_id, player_id, choice_index, correct, points_awarded)
    values (p_room_id, p_question_id, p_player_id, p_choice_index, false, 0)
    on conflict (question_id, player_id) do nothing;

  return query select found;
end;
$function$;

-- ---------------------------------------------------------------------
-- Scoring: tallies each team's votes for the question that just closed.
-- Deliberately does NOT touch teams.score (that would leak correctness in
-- realtime the instant it changed) -- it only records into the locked-down
-- team_answers table. teams.score is bulk-computed once, only when the room
-- actually reaches 'final' (see finalize_final_scores below).
-- ---------------------------------------------------------------------

create or replace function public.finalize_question_scoring(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.rooms;
  v_question_id uuid;
  v_correct_index smallint;
  v_team record;
  v_tally record;
  v_winning_choice smallint;
  v_winning_count int;
  v_points int;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    return;
  end if;

  select rq.question_id, q.correct_index into v_question_id, v_correct_index
    from public.room_questions rq join public.questions q on q.id = rq.question_id
    where rq.room_id = p_room_id and rq.order_index = v_room.current_question_index;

  if v_question_id is null then
    return;
  end if;

  for v_team in
    select distinct pl.team_id from public.players pl
    where pl.room_id = p_room_id and pl.team_id is not null and pl.left_at is null
  loop
    v_winning_choice := null;
    v_winning_count := 0;

    for v_tally in
      select a.choice_index, count(*) as votes
      from public.answers a
      join public.players pl on pl.id = a.player_id
      where a.question_id = v_question_id and pl.team_id = v_team.team_id and pl.left_at is null
      group by a.choice_index
      order by count(*) desc, min(a.answered_at) asc
    loop
      v_winning_choice := v_tally.choice_index;
      v_winning_count := v_tally.votes;
      exit;
    end loop;

    v_points := 0;
    if v_winning_choice is not null and v_winning_choice = v_correct_index then
      v_points := 1000;
    end if;

    insert into public.team_answers (room_id, team_id, question_id, choice_index, correct, points_awarded, vote_count)
      values (p_room_id, v_team.team_id, v_question_id, v_winning_choice,
              coalesce(v_winning_choice = v_correct_index, false), v_points, v_winning_count)
      on conflict (team_id, question_id) do nothing;
  end loop;
end;
$function$;

create or replace function public.finalize_final_scores(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.teams t set score = coalesce(
    (select sum(ta.points_awarded) from public.team_answers ta where ta.team_id = t.id), 0
  )
  where t.room_id = p_room_id;
end;
$function$;

-- ---------------------------------------------------------------------
-- Round start: merge undersized self-teams into the auto pool, then lock
-- every team in the room so membership can't change once questions start.
-- ---------------------------------------------------------------------

create or replace function public.finalize_voting_and_start(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.rooms;
  v_votes_a int;
  v_votes_b int;
  v_winner uuid;
  v_question_ids uuid[];
  v_questions_per_game constant int := 20;
  v_small_team record;
  v_member record;
  v_new_team_id uuid;
  v_new_team_name text;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or v_room.phase <> 'lobby' then
    return;
  end if;

  for v_small_team in
    select t.id from public.teams t
    where t.room_id = p_room_id and t.kind = 'self' and not t.locked
      and (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null) < 3
  loop
    for v_member in select pl.id from public.players pl where pl.team_id = v_small_team.id and pl.left_at is null loop
      select o_team_id, o_team_name into v_new_team_id, v_new_team_name from public.auto_bucket_team(p_room_id);
      update public.players set team_id = v_new_team_id where id = v_member.id;
    end loop;
    delete from public.teams where id = v_small_team.id;
  end loop;

  update public.teams set locked = true where room_id = p_room_id;

  select count(*) filter (where choice = 0), count(*) filter (where choice = 1)
    into v_votes_a, v_votes_b
    from public.category_votes where room_id = p_room_id;

  if v_votes_a > v_votes_b then
    v_winner := v_room.category_option_a;
  elsif v_votes_b > v_votes_a then
    v_winner := v_room.category_option_b;
  else
    v_winner := (array[v_room.category_option_a, v_room.category_option_b])[1 + floor(random() * 2)::int];
  end if;

  select array_agg(id order by random()) into v_question_ids from (
    select id from public.questions where pack_id = v_winner
    order by last_used_at nulls first, random()
    limit v_questions_per_game
  ) picked;

  update public.questions set last_used_at = now() where id = any(v_question_ids);

  insert into public.room_questions (room_id, order_index, question_id)
  select p_room_id, ord - 1, qid from unnest(v_question_ids) with ordinality as t(qid, ord);

  update public.rooms set
    winning_category_id = v_winner,
    phase = 'question',
    current_question_index = 0,
    question_started_at = now(),
    phase_started_at = now(),
    revealed_correct_index = null
  where id = p_room_id;
end;
$function$;

-- ---------------------------------------------------------------------
-- Autonomous ticker: question -> question (or final) directly, no
-- per-question reveal/leaderboard stop anymore.
-- ---------------------------------------------------------------------

create or replace function public.tick()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_final_dwell constant int := 20;
  v_lobby_boarding_seconds constant int := 20;
  v_room record;
  v_total int;
begin
  for v_room in select * from public.rooms where phase <> 'final' or not retired loop

    if v_room.phase = 'lobby' and v_room.starts_at is not null and v_room.starts_at <= now() then
      perform public.finalize_voting_and_start(v_room.id);

    elsif v_room.phase = 'question' then
      select q.time_limit_seconds into v_total
        from public.room_questions rq join public.questions q on q.id = rq.question_id
        where rq.room_id = v_room.id and rq.order_index = v_room.current_question_index;

      if now() >= v_room.question_started_at + make_interval(secs => v_total) then
        perform public.finalize_question_scoring(v_room.id);

        select count(*) into v_total from public.room_questions where room_id = v_room.id;
        if v_room.current_question_index + 1 >= v_total then
          perform public.finalize_final_scores(v_room.id);
          update public.rooms set phase = 'final', phase_started_at = now() where id = v_room.id;
        else
          update public.rooms set
            phase = 'question', current_question_index = v_room.current_question_index + 1,
            question_started_at = now(), phase_started_at = now(), revealed_correct_index = null
          where id = v_room.id;
        end if;
      end if;

    elsif v_room.phase = 'final' and not v_room.retired then
      if now() >= v_room.phase_started_at + make_interval(secs => v_final_dwell) then
        update public.rooms set retired = true where id = v_room.id;
      end if;
    end if;

  end loop;

  if not exists (select 1 from public.rooms where not retired) then
    perform public.create_room(now() + make_interval(secs => v_lobby_boarding_seconds));
  end if;
end;
$function$;

-- ---------------------------------------------------------------------
-- Host manual controls: same simplification -- Next Question / End
-- ---------------------------------------------------------------------

create or replace function public.advance_phase(p_room_id uuid, p_host_secret uuid, p_action text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.rooms;
  v_total int;
begin
  perform 1 from public.room_hosts where room_id = p_room_id and host_secret = p_host_secret;
  if not found then
    raise exception 'NOT_AUTHORIZED_OR_NOT_FOUND';
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    raise exception 'NOT_AUTHORIZED_OR_NOT_FOUND';
  end if;

  if p_action = 'next_question' then
    if v_room.phase <> 'question' then
      raise exception 'WRONG_PHASE';
    end if;
    perform public.finalize_question_scoring(p_room_id);

    select count(*) into v_total from public.room_questions where room_id = p_room_id;
    if v_room.current_question_index + 1 >= v_total then
      perform public.finalize_final_scores(p_room_id);
      update public.rooms set phase = 'final', phase_started_at = now() where id = p_room_id;
    else
      update public.rooms set
        phase = 'question', current_question_index = v_room.current_question_index + 1,
        question_started_at = now(), phase_started_at = now(), revealed_correct_index = null
      where id = p_room_id;
    end if;

  elsif p_action = 'end' then
    perform public.finalize_question_scoring(p_room_id);
    perform public.finalize_final_scores(p_room_id);
    update public.rooms set phase = 'final', phase_started_at = now() where id = p_room_id;

  else
    raise exception 'UNKNOWN_ACTION';
  end if;
end;
$function$;

-- ---------------------------------------------------------------------
-- Final recap: the only way team_answers' correctness ever reaches a
-- client, and only once the room has actually reached 'final'.
-- ---------------------------------------------------------------------

create or replace function public.get_final_recap(p_room_id uuid)
returns table(
  o_question_order int,
  o_prompt text,
  o_choices jsonb,
  o_correct_index smallint,
  o_team_id uuid,
  o_team_name text,
  o_team_choice smallint,
  o_team_correct boolean,
  o_team_points int
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found or v_room.phase <> 'final' then
    raise exception 'NOT_FINAL_YET';
  end if;

  return query
    select rq.order_index, q.prompt, q.choices, q.correct_index,
           t.id, t.name, ta.choice_index, ta.correct, ta.points_awarded
    from public.room_questions rq
    join public.questions q on q.id = rq.question_id
    left join public.team_answers ta on ta.question_id = rq.question_id and ta.room_id = p_room_id
    left join public.teams t on t.id = ta.team_id
    where rq.room_id = p_room_id
    order by rq.order_index, t.name;
end;
$function$;

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------

revoke execute on function public.auto_bucket_team(uuid) from anon, authenticated, public;
revoke execute on function public.finalize_question_scoring(uuid) from anon, authenticated, public;
revoke execute on function public.finalize_final_scores(uuid) from anon, authenticated, public;
revoke execute on function public.finalize_voting_and_start(uuid) from anon, authenticated, public;

grant execute on function public.join_room(text, text, uuid, text) to anon, authenticated;
grant execute on function public.cast_team_vote(uuid, uuid, uuid, uuid, smallint) to anon, authenticated;
grant execute on function public.get_final_recap(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Beta cleanup: any room mid-flight in the old solo model when this ships
-- would otherwise get stuck forever in a 'reveal'/'leaderboard' phase the
-- new tick() no longer handles, which would also block the "board a fresh
-- room if none exist" fallback. Testing-mode data only, safe to retire.
-- ---------------------------------------------------------------------

update public.rooms set retired = true where not retired;
