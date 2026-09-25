-- Monthly trivia seasons. Each phone picks one username per month (per
-- venue calendar month) and plays every trivia game that month under it.
-- On the 1st, usernames and leaderboards (the champion streak) reset and
-- everyone picks a new name. Usernames are unique within a season.

create table public.season_profiles (
  device_key text not null,
  season_month date not null,          -- first day of the month, venue time
  username text not null,
  created_at timestamptz not null default now(),
  primary key (device_key, season_month)
);
create unique index season_profiles_username_idx on public.season_profiles (season_month, lower(username));
alter table public.season_profiles enable row level security; -- read through the functions below

-- The season a venue is in right now, and when it ends.
create or replace function public.trivia_season(p_venue text)
returns table(o_season_month date, o_resets_at timestamptz, o_timezone text)
language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v public.venues;
  v_tz text;
  v_month date;
begin
  v := public.venue_by_slug(p_venue);
  v_tz := coalesce(v.timezone, 'America/Chicago');
  v_month := date_trunc('month', now() at time zone v_tz)::date;
  return query select v_month, ((v_month + interval '1 month')::timestamp at time zone v_tz), v_tz;
end;
$function$;
grant execute on function public.trivia_season(text) to anon, authenticated;

-- This phone's username for the current season (null if not picked yet).
create or replace function public.get_season_profile(p_device_key text, p_venue text)
returns table(o_username text, o_season_month date, o_resets_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $function$
declare
  s record;
begin
  select * into s from public.trivia_season(p_venue);
  return query
    select (select sp.username from public.season_profiles sp
             where sp.device_key = p_device_key and sp.season_month = s.o_season_month),
           s.o_season_month, s.o_resets_at;
end;
$function$;
grant execute on function public.get_season_profile(text, text) to anon, authenticated;

-- Pick this season's username (once per phone per month).
create or replace function public.claim_season_username(p_device_key text, p_venue text, p_username text)
returns table(o_username text)
language plpgsql security definer set search_path to 'public' as $function$
declare
  s record;
  v_name text := trim(coalesce(p_username, ''));
  v_existing text;
begin
  if length(coalesce(p_device_key, '')) not between 8 and 64 then
    raise exception 'INVALID_DEVICE';
  end if;
  if length(v_name) < 2 or length(v_name) > 20 then
    raise exception 'INVALID_USERNAME';
  end if;
  if v_name ilike 'bot %' then
    raise exception 'INVALID_USERNAME';
  end if;
  select * into s from public.trivia_season(p_venue);
  select username into v_existing from public.season_profiles
    where device_key = p_device_key and season_month = s.o_season_month;
  if v_existing is not null then
    return query select v_existing; -- already picked this month; it's locked
    return;
  end if;
  begin
    insert into public.season_profiles (device_key, season_month, username) values (p_device_key, s.o_season_month, v_name);
  exception when unique_violation then
    raise exception 'USERNAME_TAKEN';
  end;
  return query select v_name;
end;
$function$;
grant execute on function public.claim_season_username(text, text, text) to anon, authenticated;
