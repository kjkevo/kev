-- Nicknames and short forms players really type, checked against the
-- answer checker: each of these was marked wrong before.
create or replace function pg_temp.add_alias(p_prompt_part text, p_aliases text[])
returns void
language plpgsql
as $$
begin
  update public.questions set accepted_answers = array(select distinct unnest(coalesce(accepted_answers, '{}') || p_aliases))
    where prompt ilike '%' || p_prompt_part || '%' and active;
  if not found then
    raise exception 'question not found: %', p_prompt_part;
  end if;
end;
$$;

select pg_temp.add_alias('time-traveling DeLorean', array['BTTF']);
select pg_temp.add_alias('whip-wielding archaeologist', array['Indy']);
select pg_temp.add_alias('murder mystery in a mansion', array['Cluedo']);
select pg_temp.add_alias('I Want It That Way', array['BSB']);
select pg_temp.add_alias('popularized photo filters', array['Insta', 'IG']);
select pg_temp.add_alias('New Coke', array['Coke', 'Coca Cola']);
select pg_temp.add_alias('resembling a trash can', array['Artoo', 'Artoo-Detoo']);
select pg_temp.add_alias('Luke Skywalkers father', array['Anakin', 'Anakin Skywalker', 'Vader']);
select pg_temp.add_alias('The King of Pop', array['MJ']);
select pg_temp.add_alias('released the album "1989"', array['T Swift', 'Taylor']);
select pg_temp.add_alias('Jack Dawson', array['Leo', 'DiCaprio']);
select pg_temp.add_alias('Katniss Everdeen in "The Hunger Games" films', array['JLaw', 'J Law']);
select pg_temp.add_alias('red-haired clown', array['Mickey D''s', 'Mickey Ds', 'Micky Ds']);
select pg_temp.add_alias('fight for the Iron Throne', array['GoT']);
select pg_temp.add_alias('played on clay courts', array['Roland Garros', 'Roland-Garros']);
select pg_temp.add_alias('"Dynamite" and "Butter"', array['Bangtan Boys', 'Bangtan Sonyeondan']);
