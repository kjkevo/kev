-- Idle rest. When nobody real has touched a venue's games for 20 minutes,
-- its games go to rest: live rooms are closed and no new ones open (so the
-- bots, the carousel feed and the dashboard go quiet). The moment someone
-- opens a game page at that venue (touch_activity), it wakes and a fresh
-- lobby opens within a second.
--
-- The "Automatic Roller Coaster" setting (app_settings.always_on) turns
-- this off so games run around the clock. It's off while testing; switch it
-- on before launch (dashboard → Venues, links and test bots).

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security; -- dashboard + functions only
insert into public.app_settings (key, value) values ('always_on', 'false') on conflict (key) do nothing;

alter table public.venues add column if not exists last_activity_at timestamptz;
alter table public.venues add column if not exists asleep boolean not null default false;
alter table public.venues add column if not exists asleep_since timestamptz;
update public.venues set last_activity_at = now() where last_activity_at is null;

-- Called by player-facing pages while they're open (not the TV screens).
create or replace function public.touch_activity(p_venue text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v public.venues;
begin
  v := public.venue_by_slug(p_venue);
  if v.id is null then
    return;
  end if;
  if v.asleep or v.last_activity_at is null or v.last_activity_at < now() - interval '30 seconds' then
    update public.venues set last_activity_at = now(), asleep = false, asleep_since = null where id = v.id;
  end if;
end;
$function$;
grant execute on function public.touch_activity(text) to anon, authenticated;

create or replace function public.rest_idle_venues()
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v record;
  v_last timestamptz;
begin
  if coalesce((select (value #>> '{}')::boolean from public.app_settings where key = 'always_on'), false) then
    update public.venues set asleep = false, asleep_since = null where asleep;
    return;
  end if;

  for v in select * from public.venues where active and not asleep
    and coalesce(last_activity_at, created_at) < now() - interval '20 minutes'
  loop
    -- Real players still in a game count as activity even if their page
    -- hasn't pinged (e.g. a phone that's locked mid-round).
    select greatest(
      (select max(pl.joined_at) from public.players pl join public.rooms r on r.id = pl.room_id
        where r.venue_id = v.id and pl.nickname not like 'BOT %'),
      (select max(a.answered_at) from public.answers a join public.players pl on pl.id = a.player_id
        join public.rooms r on r.id = pl.room_id where r.venue_id = v.id and pl.nickname not like 'BOT %'),
      (select max(c.created_at) from public.checkins c where c.venue_id = v.id)
    ) into v_last;
    if v_last is not null and v_last > now() - interval '20 minutes' then
      update public.venues set last_activity_at = v_last where id = v.id;
      continue;
    end if;

    update public.venues set asleep = true, asleep_since = now() where id = v.id;
    update public.rooms set retired = true, phase = 'final', phase_started_at = now() where venue_id = v.id and not retired;
    update public.feud_rooms set retired = true, phase = 'final', phase_started_at = now() where venue_id = v.id and not retired;
    update public.bingo_rooms set retired = true, phase = 'final', phase_started_at = now() where venue_id = v.id and not retired;
  end loop;
end;
$function$;
revoke execute on function public.rest_idle_venues() from anon, authenticated, public;

-- Game clocks: don't open rooms at a resting venue.
do $$
declare
  v_def text;
  v_old text;
begin
  v_def := pg_get_functiondef('public.tick()'::regprocedure);
  v_old := 'for v_venue in select ve.id from public.venues ve where ve.active loop';
  if position(v_old in v_def) = 0 then raise exception 'tick() venue loop not found'; end if;
  execute replace(v_def, v_old, 'for v_venue in select ve.id from public.venues ve where ve.active and not ve.asleep loop');

  v_def := pg_get_functiondef('public.tick_feud()'::regprocedure);
  v_old := 'where ve.active and not exists (select 1 from public.feud_rooms';
  if position(v_old in v_def) = 0 then raise exception 'tick_feud() venue filter not found'; end if;
  execute replace(v_def, v_old, 'where ve.active and not ve.asleep and not exists (select 1 from public.feud_rooms');

  v_def := pg_get_functiondef('public.tick_bingo()'::regprocedure);
  v_old := 'where ve.active and not exists (select 1 from public.bingo_rooms';
  if position(v_old in v_def) = 0 then raise exception 'tick_bingo() venue filter not found'; end if;
  execute replace(v_def, v_old, 'where ve.active and not ve.asleep and not exists (select 1 from public.bingo_rooms');

  -- Watchdog: put idle venues to rest first; don't "fix" a resting venue's
  -- missing lobby; mention resting venues as a heads-up.
  v_def := pg_get_functiondef('public.ops_watchdog()'::regprocedure);
  v_old := 'where ve.active and not exists (select 1 from public.rooms r where not r.retired and r.venue_id = ve.id)';
  if position(v_old in v_def) = 0 then raise exception 'ops_watchdog() no-live-room filter not found'; end if;
  v_def := replace(v_def, v_old, 'where ve.active and not ve.asleep and not exists (select 1 from public.rooms r where not r.retired and r.venue_id = ve.id)');
  v_old := 'where ve.active and ve.test_bots';
  if position(v_old in v_def) = 0 then raise exception 'ops_watchdog() test-bots filter not found'; end if;
  v_def := replace(v_def, v_old, 'where ve.active and not ve.asleep and ve.test_bots');
  v_old := '  update public.ops_events set resolved_at = now()
    where resolved_at is null and source = ''watchdog'' and last_seen_at < v_run_started;';
  if position(v_old in v_def) = 0 then raise exception 'ops_watchdog() resolve step not found'; end if;
  v_def := replace(v_def, v_old, '  for v_room in select ve.slug, ve.name, ve.asleep_since from public.venues ve where ve.active and ve.asleep loop
    perform public.ops_raise(''venue_resting'', ''heads_up'', null, v_room.slug,
      ''Games are resting at '' || v_room.name,
      ''Nobody played for 20 minutes, so the games were put to rest at '' || to_char(v_room.asleep_since at time zone ''UTC'', ''HH24:MI'') || '' UTC. They wake up the moment someone opens a game page.'',
      ''Automatic Roller Coaster is off. Turn it on before launch to keep games running around the clock.'');
  end loop;

' || v_old);
  v_old := 'begin
  for v_room in select id, code from public.rooms where retired and phase <> ''final'' loop';
  if position(v_old in v_def) = 0 then raise exception 'ops_watchdog() start not found'; end if;
  v_def := replace(v_def, v_old, 'begin
  perform public.rest_idle_venues();
  for v_room in select id, code from public.rooms where retired and phase <> ''final'' loop');
  execute v_def;
end;
$$;
