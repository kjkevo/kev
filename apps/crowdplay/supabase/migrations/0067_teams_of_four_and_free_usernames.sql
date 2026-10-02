-- Teams max out at 4 players (was 5).
do $$
declare
  f text;
  d text;
  n int;
begin
  foreach f in array array['join_room', 'rejoin_next_game', 'finalize_voting_and_start', 'auto_bucket_team'] loop
    d := pg_get_functiondef(('public.' || f)::regproc);
    n := length(d);
    d := replace(d, 'v_max_team_size constant int := 5;', 'v_max_team_size constant int := 4;');
    if d = pg_get_functiondef(('public.' || f)::regproc) then
      raise exception '% team size patch did not apply', f;
    end if;
    execute d;
  end loop;
end $$;

-- Which of these generated usernames nobody has this month (so a new
-- player is never offered a name that's taken).
create or replace function public.free_season_usernames(p_venue text, p_names text[])
returns table(o_username text)
language plpgsql stable security definer set search_path to 'public' as $function$
declare
  s record;
begin
  select * into s from public.trivia_season(p_venue);
  return query
    select n from unnest(p_names[1:50]) n
    where length(trim(n)) between 2 and 20
      and not exists (select 1 from public.season_profiles sp
                      where sp.season_month = s.o_season_month and lower(sp.username) = lower(n));
end;
$function$;
grant execute on function public.free_season_usernames(text, text[]) to anon, authenticated;
