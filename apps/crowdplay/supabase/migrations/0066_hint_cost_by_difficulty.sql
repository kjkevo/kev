-- Hints cost 50 to 150 points depending on the question, instead of half.
-- Easy: -50, medium: -100, hard: -150 (a right answer is worth 1000).
-- The phone reads the cost from questions_public.hint_cost.

create or replace function public.trivia_hint_cost(p_question_id uuid)
returns int language sql stable security definer set search_path to 'public' as $function$
  select case q.difficulty when 'hard' then 150 when 'medium' then 100 else 50 end
  from public.questions q where q.id = p_question_id;
$function$;

create or replace function public.trivia_team_points(p_team_id uuid, p_question_id uuid)
returns int language sql stable security definer set search_path to 'public' as $function$
  select 1000 - case when exists (select 1 from public.team_hints h where h.team_id = p_team_id and h.question_id = p_question_id)
    then public.trivia_hint_cost(p_question_id) else 0 end;
$function$;
revoke execute on function public.trivia_team_points(uuid, uuid) from anon, authenticated, public;

create or replace view public.questions_public as
  select id, pack_id, order_index, prompt, choices, time_limit_seconds,
         case difficulty when 'hard' then 150 when 'medium' then 100 else 50 end as hint_cost
  from public.questions;
