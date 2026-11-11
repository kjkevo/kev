-- Gentler levels, so characters every 5 levels are reachable by playing
-- (about 100 XP a game): reaching level L takes 100*(L-1) + 5*(L-1)^2 XP.
--   Level 5 ~ 5 games, 10 ~ 13, 20 ~ 37, 30 ~ 70, 35 ~ 92.
create or replace function public.progress_level_xp(p_level int) returns int
language sql immutable as $$ select 100 * (p_level - 1) + 5 * (p_level - 1) * (p_level - 1); $$;

create or replace function public.progress_level(p_xp int) returns int
language sql immutable as $$
  select greatest(1, floor((-100 + sqrt(10000 + 20 * greatest(p_xp, 0)::numeric)) / 10 + 1e-9)::int + 1);
$$;
