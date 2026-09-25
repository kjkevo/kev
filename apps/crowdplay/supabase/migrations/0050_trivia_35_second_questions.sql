-- Each trivia question now runs 35 seconds (was 45).
alter table public.questions alter column time_limit_seconds set default 35;
update public.questions set time_limit_seconds = 35 where time_limit_seconds <> 35;
