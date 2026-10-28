-- Mind Probe was a snapshot taken the moment it was used, and refused with
-- NO_VOTES_YET when nobody else had answered. Bots answer late in the clock,
-- so early in a question it showed one vote or nothing and looked broken.
-- Now it can be used any time and shows everyone else's votes live, every
-- time the phone refreshes, until the question ends.

-- Everyone else's votes on a question, per choice.
create or replace function public.trivia_probe_counts(p_room_id uuid, p_question_id uuid, p_team_id uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  select jsonb_build_object(
    'total', (select count(*) from public.answers a join public.players pl on pl.id = a.player_id
              where a.question_id = p_question_id and pl.room_id = p_room_id and pl.left_at is null
                and pl.team_id is distinct from p_team_id and a.answer_text is not null),
    'counts', coalesce((select jsonb_object_agg(c.value, (
        select count(*) from public.answers a join public.players pl on pl.id = a.player_id
        where a.question_id = p_question_id and pl.room_id = p_room_id and pl.left_at is null
          and pl.team_id is distinct from p_team_id and lower(btrim(a.answer_text)) = lower(btrim(c.value))))
      from public.questions q, jsonb_array_elements_text(q.choices) c(value) where q.id = p_question_id), '{}'::jsonb));
$function$;
revoke execute on function public.trivia_probe_counts(uuid, uuid, uuid) from public, anon, authenticated;

do $patch$
declare d text; n text;
begin
  -- use_power: no more NO_VOTES_YET; record the counts as they are right now.
  d := pg_get_functiondef('public.use_power(uuid, uuid, uuid, uuid)'::regprocedure);
  n := regexp_replace(d,
    '  elsif v_power = ''probe'' then.*?(  elsif v_power = ''riddle'' then)',
    E'  elsif v_power = ''probe'' then\n    v_data := public.trivia_probe_counts(p_room_id, p_question_id, v_team);\n\n\\1');
  if n = d then raise exception 'use_power probe patch did not apply'; end if;
  execute n;

  -- get_team_powers: a Mind Probe's data is always the live count.
  d := pg_get_functiondef('public.get_team_powers(uuid, uuid, uuid, uuid)'::regprocedure);
  n := replace(d, '    tp.power, tp.player_id, tp.data',
    '    tp.power, tp.player_id,
    case when tp.power = ''probe'' then public.trivia_probe_counts(p_room_id, p_question_id, v_team) else tp.data end');
  if n = d then raise exception 'get_team_powers patch did not apply'; end if;
  execute n;
end $patch$;
