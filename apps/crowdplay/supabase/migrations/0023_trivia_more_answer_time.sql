-- 30s still felt rushed for typing a real answer as a team (read, think,
-- type, agree on who's submitting). Bumping to 45s.
update public.questions set time_limit_seconds = 45;
alter table public.questions alter column time_limit_seconds set default 45;
