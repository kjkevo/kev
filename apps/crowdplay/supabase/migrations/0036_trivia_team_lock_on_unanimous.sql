-- A team's answer locks in the moment every active member agrees, instead of
-- waiting for the timer. "Agrees" is by meaning (trivia_vote_key), so "mint"
-- and "mint leaves" count as the same answer. Once locked, the team's votes
-- can't change. Teams that never agree still get majority rules when the
-- timer runs out (finalize_question_scoring skips teams already locked).
-- A one-person team never locks early, so a solo player can fix a typo.

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
                  case when v_key = 'correct' then 1000 else 0 end, v_votes)
          on conflict (team_id, question_id) do nothing;
      end if;
    end if;
  end if;

  return query select true;
end;
$function$;

-- What a phone needs to show "locked in" (never whether it was right).
create or replace function public.get_team_answer_lock(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_question_id uuid)
returns table(o_locked boolean, o_answer_text text)
language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_team uuid;
  v_text text;
begin
  select pl.team_id into v_team from public.players pl
    where pl.id = p_player_id and pl.room_id = p_room_id and pl.client_token = p_client_token;
  if v_team is null then
    raise exception 'NOT_AUTHORIZED';
  end if;
  select ta.answer_text into v_text from public.team_answers ta
    where ta.team_id = v_team and ta.question_id = p_question_id;
  return query select found, v_text;
end;
$function$;
grant execute on function public.get_team_answer_lock(uuid, uuid, uuid, uuid) to anon, authenticated;

-- Where every team stands on the current question, for the "other teams"
-- strip on phones (and anyone else): locked in or still voting, and how many
-- members have voted. Never the answers themselves.
create or replace function public.get_team_progress(p_room_id uuid, p_question_id uuid)
returns table(o_team_id uuid, o_team_name text, o_locked boolean, o_voted int, o_members int)
language sql stable security definer set search_path to 'public' as $function$
  select t.id, t.name,
    exists (select 1 from public.team_answers ta where ta.team_id = t.id and ta.question_id = p_question_id),
    (select count(*)::int from public.answers a join public.players pl on pl.id = a.player_id
      where a.question_id = p_question_id and pl.team_id = t.id and pl.left_at is null),
    (select count(*)::int from public.players pl where pl.team_id = t.id and pl.left_at is null)
  from public.teams t
  where t.room_id = p_room_id
    and exists (select 1 from public.players pl where pl.team_id = t.id and pl.left_at is null)
  order by t.created_at;
$function$;
grant execute on function public.get_team_progress(uuid, uuid) to anon, authenticated;
