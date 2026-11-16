-- Play only at the bar.
--   * The bar's TV shows a QR code with today's check-in code (changes every
--     day at noon, bar time). Scanning it checks this phone in at that bar.
--   * Only TVs paired with the bar's private setup link show the code, so
--     opening the TV page at home doesn't give it away.
--   * Joining any game needs a check-in at that game's bar.
--   * 20 minutes with no taps or answers ends the check-in (time in a lobby
--     or a game doesn't count: the game page keeps it alive). Scan the TV
--     again to play. XP already earned stays.
--   * The owner has a private code that checks in at any bar (testing, demos).

alter table public.venues add column if not exists screen_secret text not null default substr(md5(random()::text || clock_timestamp()::text), 1, 24);
alter table public.venue_screens add column if not exists approved boolean not null default false;

create table if not exists public.play_passes (
  device_key text primary key,
  venue_id uuid not null references public.venues(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);
alter table public.play_passes enable row level security;

insert into public.app_secrets (name, value)
  values ('checkin_salt', md5(random()::text || clock_timestamp()::text)), ('owner_pass_code', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)))
  on conflict do nothing;

-- Today's 6-letter code for a bar (a new one every day at noon, bar time).
create or replace function public.venue_day_code(p_venue_id uuid) returns text
language sql stable security definer set search_path to 'public' as $$
  select upper(substr(md5((select value from public.app_secrets where name = 'checkin_salt') || p_venue_id::text ||
    (public.venue_night_start(coalesce(v.timezone, 'America/Chicago')) at time zone coalesce(v.timezone, 'America/Chicago'))::date::text), 1, 6))
  from public.venues v where v.id = p_venue_id
$$;

-- Pair a TV once with the bar's private setup link.
create or replace function public.pair_screen(p_venue text, p_screen_key text, p_secret text) returns boolean
language plpgsql security definer set search_path to 'public' as $function$
declare v public.venues := public.venue_by_slug(p_venue);
begin
  if v.id is null or p_secret is distinct from v.screen_secret or length(coalesce(p_screen_key, '')) not between 8 and 64 then
    return false;
  end if;
  insert into public.venue_screens (venue_id, screen_key, page, approved) values (v.id, p_screen_key, 'paired', true)
    on conflict (venue_id, screen_key) do update set approved = true, last_seen_at = now();
  return true;
end;
$function$;

-- Today's code, only for a paired TV.
create or replace function public.get_checkin_code(p_venue text, p_screen_key text) returns text
language plpgsql stable security definer set search_path to 'public' as $function$
declare v public.venues := public.venue_by_slug(p_venue);
begin
  if v.id is null or not exists (select 1 from public.venue_screens s where s.venue_id = v.id and s.screen_key = p_screen_key and s.approved) then
    return null;
  end if;
  return public.venue_day_code(v.id);
end;
$function$;

-- Scanning the TV: check this phone in at the bar.
create or replace function public.check_in(p_venue text, p_code text, p_device_key text) returns boolean
language plpgsql security definer set search_path to 'public' as $function$
declare v public.venues := public.venue_by_slug(p_venue);
begin
  if v.id is null or length(coalesce(p_device_key, '')) not between 8 and 64 then return false; end if;
  if upper(coalesce(p_code, '')) <> public.venue_day_code(v.id)
     and upper(coalesce(p_code, '')) <> (select value from public.app_secrets where name = 'owner_pass_code') then
    return false;
  end if;
  insert into public.play_passes (device_key, venue_id) values (p_device_key, v.id)
    on conflict (device_key) do update set venue_id = excluded.venue_id, checked_in_at = now(), last_active_at = now();
  return true;
end;
$function$;

-- Activity (taps, answers, being in a game) keeps the check-in alive.
-- Returns false once it has ended (20 minutes idle) or there isn't one.
create or replace function public.touch_pass(p_device_key text) returns boolean
language plpgsql security definer set search_path to 'public' as $function$
begin
  update public.play_passes set last_active_at = now()
    where device_key = p_device_key and last_active_at > now() - interval '20 minutes';
  return found;
end;
$function$;

-- For the "scan the TV" screen: checked in where, and did they have one.
create or replace function public.pass_status(p_device_key text)
returns table(o_valid boolean, o_venue text, o_had_pass boolean)
language sql stable security definer set search_path to 'public' as $$
  select coalesce(bool_or(p.last_active_at > now() - interval '20 minutes'), false),
    max(v.slug), count(p.device_key) > 0
  from public.play_passes p join public.venues v on v.id = p.venue_id
  where p.device_key = p_device_key
$$;

-- Used by every join: a live check-in at this game's bar, or no game.
create or replace function public.pass_use(p_device_key text, p_venue_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  update public.play_passes set last_active_at = now()
    where device_key = p_device_key and venue_id = p_venue_id and last_active_at > now() - interval '20 minutes';
  if not found then raise exception 'CHECK_IN'; end if;
end;
$function$;

do $x$
declare f text; fn text; g text;
begin
  foreach fn in array array['dl_join', 'wm_join', 'sb_join'] loop
    select pg_get_functiondef(('public.' || fn)::regproc) into f;
    g := 'if not found then raise exception ''ROOM_NOT_FOUND''; end if;';
    if position(g in f) = 0 then raise exception '% anchor', fn; end if;
    execute replace(f, g, g || E'\n  perform public.pass_use(p_device_key, r.venue_id);');
  end loop;
  select pg_get_functiondef('public.join_room'::regproc) into f;
  g := E'    raise exception ''ROOM_NOT_FOUND'';\n  end if;\n';
  if position(g in f) = 0 then raise exception 'join_room anchor'; end if;
  execute regexp_replace(f, E'    raise exception ''ROOM_NOT_FOUND'';\n  end if;\n',
    E'    raise exception ''ROOM_NOT_FOUND'';\n  end if;\n  perform public.pass_use(p_device_key, v_room.venue_id);\n');
end $x$;
