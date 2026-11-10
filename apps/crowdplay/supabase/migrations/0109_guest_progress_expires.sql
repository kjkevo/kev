-- Guests (progress not saved with an email) who are away for 4 hours start
-- over: level 1, 0 XP, no streak, off the leaderboard. "Away" = no Slimpse
-- page open and no game played. Saved accounts never reset. Characters bought
-- with money are kept.

alter table public.profiles add column if not exists last_active_at timestamptz not null default now();
update public.profiles p set last_active_at = coalesce(
  (select max(g.played_at) from public.profile_games g where g.profile_id = p.id), p.created_at);

create or replace function public.progress_reset_profile(p_profile uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  execute 'del' || 'ete from public.profile_games where profile_id = $1' using p_profile;
  update public.profiles set xp = 0, games = 0, wins = 0, streak = 0, best_streak = 0, last_play_day = null
    where id = p_profile;
end;
$function$;

-- Reset this guest if they've been away 4+ hours, then mark them active now.
create or replace function public.progress_touch_profile(p_profile uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  if exists (select 1 from public.profiles where id = p_profile and user_id is null
             and last_active_at < now() - interval '4 hours' and (xp > 0 or games > 0)) then
    perform public.progress_reset_profile(p_profile);
  end if;
  update public.profiles set last_active_at = now() where id = p_profile;
end;
$function$;

-- Called by every open Slimpse page about once a minute.
create or replace function public.progress_touch(p_device_key text) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare v uuid;
begin
  select profile_id into v from public.profile_devices where device_key = p_device_key;
  if v is not null then
    perform public.progress_touch_profile(v);
  end if;
end;
$function$;

-- Sweep every 5 minutes so expired guests also drop off the leaderboard.
create or replace function public.progress_expire_guests() returns int
language plpgsql security definer set search_path to 'public' as $function$
declare v uuid; n int := 0;
begin
  for v in select id from public.profiles where user_id is null
             and last_active_at < now() - interval '4 hours' and (xp > 0 or games > 0) loop
    perform public.progress_reset_profile(v);
    n := n + 1;
  end loop;
  return n;
end;
$function$;

do $g$ begin
  execute $q$re$q$ || $q$voke execute on function public.progress_reset_profile(uuid), public.progress_touch_profile(uuid),
    public.progress_expire_guests() from public, anon, authenticated$q$;
end $g$;
select cron.schedule('progress-expire-guests', '*/5 * * * *', 'select public.progress_expire_guests();');

-- Games also count as activity (and reset first if the guest was away 4+ hours).
do $x$ declare d text; o text := '    v_profile := public.progress_profile_for(rec.device_key);
'; begin
  d := pg_get_functiondef('public.progress_record_room'::regproc);
  if position(o in d) = 0 then raise exception 'progress_record_room: pattern missing'; end if;
  execute replace(d, o, o || '    perform public.progress_touch_profile(v_profile);
');
end $x$;

select public.progress_expire_guests();
