-- Clue hints, fun facts, and more forgiving spelling.
--
-- 1. Each question gets a written clue (questions.hint) and a fun fact
--    (questions.fun_fact). The hint button now shows the clue instead of
--    "It's one of these two: A or B". The fun fact is shown after the answer
--    is revealed, through get_round_extras (never during the question).
--    The text itself was loaded separately (one UPDATE per question, by id).
-- 2. Spelling slack for loud, dark bars: short words may be one letter off
--    (including a missing or extra letter), sound-alike spellings count
--    ("felps" = Phelps), and longer words get a bit more room. A guess that
--    is closer to another choice still loses (unchanged trivia_text_matches).
alter table public.questions add column if not exists hint text, add column if not exists fun_fact text;

create or replace function public.trivia_tok_match(x text, y text)
returns boolean language sql immutable as $function$
  select x = y or (
    x !~ '[0-9]' and y !~ '[0-9]' and length(x) >= 3 and length(y) >= 4 and (
      (left(x, 1) = left(y, 1) and
        case when length(y) <= 5 then levenshtein(x, y) <= 1
             when length(y) <= 8 then levenshtein(x, y) <= 2
             when length(y) <= 12 then levenshtein(x, y) <= 3
             else levenshtein(x, y) <= 4 end)
      or (dmetaphone(x) = dmetaphone(y) and
          levenshtein(x, y) <= case when length(y) <= 7 then 2 else 3 end)));
$function$;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.use_team_hint(uuid,uuid,uuid,uuid)'::regprocedure);
  d := replace(d,
$old$    v_correct := v_q.choices->>v_q.correct_index;
    select c into v_wrong from jsonb_array_elements_text(v_q.choices) with ordinality e(c, i)
      where i - 1 <> v_q.correct_index order by random() limit 1;
    v_hint := 'It''s one of these two: ' || case when random() < 0.5
      then v_correct || ' or ' || v_wrong else v_wrong || ' or ' || v_correct end;$old$,
$new$    v_correct := v_q.choices->>v_q.correct_index;
    v_hint := coalesce(nullif(btrim(v_q.hint), ''),
      'It starts with "' || upper(left(btrim(v_correct), 1)) || '".');$new$);
  if position('v_q.hint' in d) = 0 then
    raise exception 'use_team_hint patch did not apply';
  end if;
  execute d;
end $$;

-- Fun fact for the current question, only once it has been revealed.
create or replace function public.get_round_extras(p_room uuid)
returns table(o_question_id uuid, o_fun_fact text)
language sql stable security definer set search_path to 'public' as $function$
  select q.id, q.fun_fact
  from public.rooms r
  join public.room_questions rq on rq.room_id = r.id and rq.order_index = r.current_question_index
  join public.questions q on q.id = rq.question_id
  where r.id = p_room and r.phase in ('reveal', 'final');
$function$;
grant execute on function public.get_round_extras(uuid) to anon, authenticated;
