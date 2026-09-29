-- Answers players really type, found in the second playtest.
update public.questions set accepted_answers = array(select distinct unnest(coalesce(accepted_answers, '{}') || array['raptor','raptors']))
  where prompt like 'In "Jurassic Park," which dinosaur famously stalks%';
update public.questions set accepted_answers = array(select distinct unnest(coalesce(accepted_answers, '{}') || array['Bruce Wayne']))
  where prompt = 'Which DC superhero is also known as the "Dark Knight"?';
