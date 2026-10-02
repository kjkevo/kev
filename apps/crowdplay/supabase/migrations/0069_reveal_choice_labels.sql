-- Reveal corners for a known wrong answer use its proper spelling
-- ("Boyz II Men", not "boyz ii men"); anything else shows the first way
-- someone typed it.
do $$
declare d text; n int;
begin
  d := pg_get_functiondef('public.get_question_reveal'::regproc);
  n := length(d);
  d := replace(d, '(select p2.answer_text from picks p2 where p2.k = p.k order by p2.answered_at limit 1),',
    E'case when p.k like ''choice:%'' then v_q.choices->>(substr(p.k, 8)::int)\n                else (select p2.answer_text from picks p2 where p2.k = p.k order by p2.answered_at limit 1) end,');
  if length(d) = n then raise exception 'get_question_reveal patch did not apply'; end if;
  execute d;
end $$;
