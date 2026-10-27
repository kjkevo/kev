-- Play-testing showed Overclock on a Golden question paying x6 (about 5,700
-- points, six normal questions' worth), which swung games too far. Bonuses
-- now add instead of multiplying: Overclock is x2 on a normal question,
-- x3 on lightning, x4 on golden.
create or replace function public.trivia_team_points(p_team_id uuid, p_question_id uuid)
returns integer language sql stable security definer set search_path to 'public' as $function$
  with q as (
    select rq.order_index, rq.twist, rq.twist_teams,
      coalesce(rq.seconds, public.trivia_question_seconds(rq.order_index)) secs
    from public.room_questions rq join public.teams t on t.room_id = rq.room_id
    where t.id = p_team_id and rq.question_id = p_question_id limit 1
  ), pw as (
    select p.power, p.triggered from public.trivia_powers p
    where p.team_id = p_team_id and p.question_id = p_question_id limit 1
  ), fastest as (
    select min(a.elapsed_ms) ms from public.answers a join public.players pl on pl.id = a.player_id
    where a.question_id = p_question_id and pl.team_id = p_team_id
      and public.trivia_vote_key(a.answer_text, p_question_id) = 'correct'
  )
  select greatest(0,
    round(
      (500 + 500 * (1 - least(greatest(
          case when (select power from pw) = 'patience' then 0 else coalesce((select ms from fastest), 0) end, 0),
          coalesce((select secs from q), 20) * 1000)::numeric
        / (coalesce((select secs from q), 20) * 1000)))
      * (case (select twist from q)
          when 'lightning' then 2
          when 'golden' then 3
          when 'comeback' then case when p_team_id = any(coalesce((select twist_teams from q), '{}')) then 1.5 else 1 end
          else 1 end
         + case when (select power from pw) = 'overclock' then 1 else 0 end)
      * case when (select power from pw) = 'second_wind' and (select triggered from pw) then 0.5 else 1 end
    )::int
    + case when (select power from pw) = 'bloom' then 300 else 0 end
    - case when exists (select 1 from public.team_hints h where h.team_id = p_team_id and h.question_id = p_question_id)
             and (select power from pw) is distinct from 'riddle'
        then public.trivia_hint_cost(p_question_id) else 0 end);
$function$;
