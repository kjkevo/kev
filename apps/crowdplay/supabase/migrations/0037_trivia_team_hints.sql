-- Hints. Any team member can ask for one on the current question; it narrows
-- the answer to two options ("It's one of these two: X or Y"), everyone on
-- the team sees it, and a correct answer on that question is then worth 500
-- instead of 1000. The phone warns about the cost before showing it.

create table public.team_hints (
  team_id uuid not null references public.teams(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  room_id uuid not null references public.rooms(id) on delete cascade,
  hint_text text not null,
  used_by uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (team_id, question_id)
);
alter table public.team_hints enable row level security; -- no policies: read through the functions below

-- What a correct answer is worth to a team on a question.
create or replace function public.trivia_team_points(p_team_id uuid, p_question_id uuid)
returns int language sql stable security definer set search_path to 'public' as $function$
  select case when exists (select 1 from public.team_hints h where h.team_id = p_team_id and h.question_id = p_question_id)
    then 500 else 1000 end;
$function$;
revoke execute on function public.trivia_team_points(uuid, uuid) from anon, authenticated, public;

create or replace function public.use_team_hint(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_question_id uuid)
returns table(o_hint text, o_points_if_right int)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_room public.rooms;
  v_team uuid;
  v_expected uuid;
  v_q public.questions;
  v_correct text;
  v_wrong text;
  v_hint text;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.phase <> 'question' then
    raise exception 'NOT_ACCEPTING_ANSWERS';
  end if;
  select pl.team_id into v_team from public.players pl
    where pl.id = p_player_id and pl.room_id = p_room_id and pl.client_token = p_client_token and pl.left_at is null;
  if v_team is null then
    raise exception 'NOT_AUTHORIZED';
  end if;
  select rq.question_id into v_expected from public.room_questions rq
    where rq.room_id = p_room_id and rq.order_index = v_room.current_question_index;
  if v_expected is null or v_expected <> p_question_id then
    raise exception 'STALE_QUESTION';
  end if;
  select * into v_q from public.questions where id = p_question_id;
  if now() >= v_room.question_started_at + make_interval(secs => v_q.time_limit_seconds) then
    raise exception 'TIME_EXPIRED';
  end if;

  perform 1 from public.teams where id = v_team for update;
  select h.hint_text into v_hint from public.team_hints h where h.team_id = v_team and h.question_id = p_question_id;
  if v_hint is null then
    if exists (select 1 from public.team_answers ta where ta.team_id = v_team and ta.question_id = p_question_id) then
      raise exception 'TEAM_LOCKED_IN';
    end if;
    v_correct := v_q.choices->>v_q.correct_index;
    select c into v_wrong from jsonb_array_elements_text(v_q.choices) with ordinality e(c, i)
      where i - 1 <> v_q.correct_index order by random() limit 1;
    v_hint := 'It''s one of these two: ' || case when random() < 0.5
      then v_correct || ' or ' || v_wrong else v_wrong || ' or ' || v_correct end;
    insert into public.team_hints (team_id, question_id, room_id, hint_text, used_by)
      values (v_team, p_question_id, p_room_id, v_hint, p_player_id);
  end if;

  return query select v_hint, public.trivia_team_points(v_team, p_question_id);
end;
$function$;
grant execute on function public.use_team_hint(uuid, uuid, uuid, uuid) to anon, authenticated;

-- A team's hint for the current question, if someone on it used one.
create or replace function public.get_team_hint(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_question_id uuid)
returns table(o_hint text)
language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_team uuid;
begin
  select pl.team_id into v_team from public.players pl
    where pl.id = p_player_id and pl.room_id = p_room_id and pl.client_token = p_client_token;
  if v_team is null then
    raise exception 'NOT_AUTHORIZED';
  end if;
  return query select h.hint_text from public.team_hints h where h.team_id = v_team and h.question_id = p_question_id;
end;
$function$;
grant execute on function public.get_team_hint(uuid, uuid, uuid, uuid) to anon, authenticated;

-- Scoring: a correct answer after a hint is worth 500 (otherwise identical
-- to 0031 / 0036).
create or replace function public.finalize_question_scoring(p_room_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v_room public.rooms;
  v_question_id uuid;
  v_team record;
  v_key text;
  v_sample text;
  v_votes int;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    return;
  end if;

  select rq.question_id into v_question_id from public.room_questions rq
    where rq.room_id = p_room_id and rq.order_index = v_room.current_question_index;
  if v_question_id is null then
    return;
  end if;

  for v_team in
    select distinct pl.team_id from public.players pl
    where pl.room_id = p_room_id and pl.team_id is not null and pl.left_at is null
  loop
    v_key := null;
    v_sample := null;
    v_votes := 0;
    select v.key, (array_agg(v.answer_text order by v.answered_at))[1], count(*)
      into v_key, v_sample, v_votes
      from (
        select public.trivia_vote_key(a.answer_text, v_question_id) as key, a.answer_text, a.answered_at
        from public.answers a
        join public.players pl on pl.id = a.player_id
        where a.question_id = v_question_id and pl.team_id = v_team.team_id and pl.left_at is null
          and a.answer_text is not null
      ) v
      group by v.key
      order by count(*) desc, min(v.answered_at) asc
      limit 1;

    insert into public.team_answers (room_id, team_id, question_id, answer_text, correct, points_awarded, vote_count)
      values (p_room_id, v_team.team_id, v_question_id, v_sample,
              coalesce(v_key = 'correct', false),
              case when v_key = 'correct' then public.trivia_team_points(v_team.team_id, v_question_id) else 0 end,
              coalesce(v_votes, 0))
      on conflict (team_id, question_id) do nothing;
  end loop;
end;
$function$;

revoke execute on function public.finalize_question_scoring(uuid) from anon, authenticated, public;

create or replace function public.cast_team_vote(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_question_id uuid, p_answer_text text)
returns table(o_recorded boolean)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_room public.rooms;
  v_expected_question_id uuid;
  v_time_limit int;
  v_team uuid;
  v_members int;
  v_votes int;
  v_keys int;
  v_key text;
  v_sample text;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.phase <> 'question' then
    raise exception 'NOT_ACCEPTING_ANSWERS';
  end if;
  if length(trim(coalesce(p_answer_text, ''))) < 1 or length(p_answer_text) > 200 then
    raise exception 'INVALID_ANSWER';
  end if;

  select pl.team_id into v_team from public.players pl
    where pl.id = p_player_id and pl.room_id = p_room_id and pl.client_token = p_client_token and pl.left_at is null;
  if not found then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select rq.question_id, q.time_limit_seconds into v_expected_question_id, v_time_limit
    from public.room_questions rq join public.questions q on q.id = rq.question_id
    where rq.room_id = p_room_id and rq.order_index = v_room.current_question_index;
  if v_expected_question_id is null or v_expected_question_id <> p_question_id then
    raise exception 'STALE_QUESTION';
  end if;
  if now() >= v_room.question_started_at + make_interval(secs => v_time_limit) then
    raise exception 'TIME_EXPIRED';
  end if;

  -- One vote at a time per team, so a lock and a vote change can't cross.
  if v_team is not null then
    perform 1 from public.teams where id = v_team for update;
    if exists (select 1 from public.team_answers ta where ta.team_id = v_team and ta.question_id = p_question_id) then
      raise exception 'TEAM_LOCKED_IN';
    end if;
  end if;

  -- answered_at keeps the first vote's time (it breaks ties); only the text changes.
  insert into public.answers (room_id, question_id, player_id, choice_index, answer_text, correct, points_awarded)
    values (p_room_id, p_question_id, p_player_id, null, trim(p_answer_text), false, 0)
    on conflict (question_id, player_id) do update set answer_text = excluded.answer_text;

  if v_team is not null then
    select count(*) into v_members from public.players pl where pl.team_id = v_team and pl.left_at is null;
    if v_members >= 2 then
      select count(*), count(distinct v.key), min(v.key), (array_agg(v.answer_text order by v.answered_at))[1]
        into v_votes, v_keys, v_key, v_sample
        from (
          select public.trivia_vote_key(a.answer_text, p_question_id) as key, a.answer_text, a.answered_at
          from public.answers a join public.players pl on pl.id = a.player_id
          where a.question_id = p_question_id and pl.team_id = v_team and pl.left_at is null and a.answer_text is not null
        ) v;
      if v_votes = v_members and v_keys = 1 then
        insert into public.team_answers (room_id, team_id, question_id, answer_text, correct, points_awarded, vote_count)
          values (p_room_id, v_team, p_question_id, v_sample, v_key = 'correct',
                  case when v_key = 'correct' then public.trivia_team_points(v_team, p_question_id) else 0 end, v_votes)
          on conflict (team_id, question_id) do nothing;
      end if;
    end if;
  end if;

  return query select true;
end;
$function$;
