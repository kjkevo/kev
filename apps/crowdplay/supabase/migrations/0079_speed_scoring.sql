-- Speed scoring, shorter multiple-choice clock and running scores.
-- * Multiple choice questions get 20 seconds, open answers (every 3rd) 35.
-- * A right answer scores 500-1000 points by how fast the team got there
--   (the earliest vote for the right answer), minus any hint.
-- * Team scores are added up after every question, and the reveal is a
--   little longer so the top 3 can be shown before the next question.
-- * The watchdog no longer gives a waiting lobby a start time while autoplay
--   is paused (it was fighting the pause every 10 seconds).

alter table public.answers add column if not exists elapsed_ms int;

create or replace function public.trivia_question_seconds(p_order_index int)
returns int language sql immutable as $function$
  select case when p_order_index % 3 = 2 then 35 else 20 end;
$function$;

-- Points for a team's right answer: 1000 for instant, down to 500 at the
-- buzzer, minus the hint cost if the team took one.
create or replace function public.trivia_team_points(p_team_id uuid, p_question_id uuid)
returns integer language sql stable security definer set search_path to 'public' as $function$
  with q as (
    select rq.order_index from public.room_questions rq join public.teams t on t.room_id = rq.room_id
    where t.id = p_team_id and rq.question_id = p_question_id limit 1
  ), fastest as (
    select min(a.elapsed_ms) ms from public.answers a join public.players pl on pl.id = a.player_id
    where a.question_id = p_question_id and pl.team_id = p_team_id
      and public.trivia_vote_key(a.answer_text, p_question_id) = 'correct'
  )
  select greatest(0,
    round(500 + 500 * (1 - least(greatest(coalesce((select ms from fastest), 0), 0),
                                 public.trivia_question_seconds(coalesce((select order_index from q), 0)) * 1000)::numeric
                           / (public.trivia_question_seconds(coalesce((select order_index from q), 0)) * 1000)))::int
    - case when exists (select 1 from public.team_hints h where h.team_id = p_team_id and h.question_id = p_question_id)
        then public.trivia_hint_cost(p_question_id) else 0 end);
$function$;

do $$
declare d text;
begin
  -- cast_team_vote: the question's clock, and when each vote came in.
  d := pg_get_functiondef('public.cast_team_vote'::regproc);
  d := replace(d, 'select rq.question_id, q.time_limit_seconds into v_expected_question_id, v_time_limit',
                  'select rq.question_id, public.trivia_question_seconds(rq.order_index) into v_expected_question_id, v_time_limit');
  d := replace(d,
$o$  insert into public.answers (room_id, question_id, player_id, choice_index, answer_text, correct, points_awarded)
    values (p_room_id, p_question_id, p_player_id, null, trim(p_answer_text), false, 0)
    on conflict (question_id, player_id) do update set answer_text = excluded.answer_text;$o$,
$n$  insert into public.answers (room_id, question_id, player_id, choice_index, answer_text, correct, points_awarded, elapsed_ms)
    values (p_room_id, p_question_id, p_player_id, null, trim(p_answer_text), false, 0,
            greatest(0, (extract(epoch from now() - v_room.question_started_at) * 1000)::int))
    on conflict (question_id, player_id) do update set answer_text = excluded.answer_text, elapsed_ms = excluded.elapsed_ms;$n$);
  if position('trivia_question_seconds' in d) = 0 or position('elapsed_ms' in d) = 0 then
    raise exception 'cast_team_vote patch did not apply';
  end if;
  execute d;

  -- use_team_hint: same clock.
  d := pg_get_functiondef('public.use_team_hint'::regproc);
  d := replace(d, 'make_interval(secs => v_q.time_limit_seconds)',
                  'make_interval(secs => public.trivia_question_seconds(v_room.current_question_index))');
  if position('trivia_question_seconds' in d) = 0 then raise exception 'use_team_hint patch did not apply'; end if;
  execute d;

  -- tick: the question's clock, a longer reveal for the standings.
  d := pg_get_functiondef('public.tick'::regproc);
  d := replace(d, 'select q.time_limit_seconds, q.id into v_total, v_question_id',
                  'select public.trivia_question_seconds(v_room.current_question_index), q.id into v_total, v_question_id');
  d := replace(d, 'v_reveal_seconds constant int := 8;', 'v_reveal_seconds constant int := 12;');
  if position('trivia_question_seconds' in d) = 0 or position(':= 12;' in d) = 0 then
    raise exception 'tick patch did not apply';
  end if;
  execute d;

  -- Running scores: add up after every question.
  d := pg_get_functiondef('public.finalize_question_scoring'::regproc);
  d := regexp_replace(d, '  end loop;\s*end;\s*\$function\$\s*$',
$n$  end loop;

  update public.teams t set score = coalesce(
    (select sum(ta.points_awarded) from public.team_answers ta where ta.team_id = t.id), 0)
    where t.room_id = p_room_id;
end;
$function$
$n$);
  if position('update public.teams t set score' in d) = 0 then raise exception 'finalize patch did not apply'; end if;
  execute d;

  -- Bots answer within the question's clock.
  d := pg_get_functiondef('public.trivia_bot_autopilot'::regproc);
  d := replace(d, 'v_limit := coalesce(b.time_limit_seconds, 35);',
                  'v_limit := public.trivia_question_seconds((select ro2.current_question_index from public.rooms ro2 where ro2.id = b.room_id));');
  execute d;

  -- Watchdog: a waiting lobby without a start time is normal while paused.
  d := pg_get_functiondef('public.ops_watchdog'::regproc);
  d := replace(d, $o$where not retired and not queued and phase = 'lobby' and starts_at is null loop$o$,
                  $n$where not retired and not queued and phase = 'lobby' and starts_at is null and public.feature_on('trivia_autoplay') loop$n$);
  d := replace(d, $o$(select q.time_limit_seconds from public.room_questions rq join public.questions q on q.id = rq.question_id
        where rq.room_id = r.id and rq.order_index = r.current_question_index) time_limit$o$,
                  $n$public.trivia_question_seconds(r.current_question_index) time_limit$n$);
  if position($p$feature_on('trivia_autoplay')$p$ in d) = 0 then raise exception 'watchdog patch did not apply'; end if;
  execute d;
end $$;

update public.ops_events set resolved_at = now() where kind = 'lobby_no_start' and resolved_at is null;

-- The scores after each question, for the top-3 screen.
create or replace function public.get_round_standings(p_room_id uuid)
returns table(o_team_id uuid, o_name text, o_score int, o_points int, o_rank int)
language sql stable security definer set search_path to 'public' as $function$
  with cur as (
    select rq.question_id from public.rooms r
    join public.room_questions rq on rq.room_id = r.id and rq.order_index = r.current_question_index
    where r.id = p_room_id
  ), live as (
    select t.id, t.name, t.score from public.teams t
    where t.room_id = p_room_id
      and exists (select 1 from public.players pl where pl.team_id = t.id)
  )
  select l.id, l.name, l.score,
    coalesce((select ta.points_awarded from public.team_answers ta where ta.team_id = l.id and ta.question_id = (select question_id from cur)), 0),
    (rank() over (order by l.score desc))::int
  from live l order by l.score desc, l.name;
$function$;
grant execute on function public.get_round_standings(uuid) to anon, authenticated;
