-- Limits on making game tables, and automatic cleanup of empty ones.
--   * A private table needs a check-in at that bar, and each phone can make
--     at most 5 every 10 minutes.
--   * Any new table (Bingo, Wild Match, Drop Line): at most 60 every 10
--     minutes per internet connection (a whole bar on one Wi-Fi is fine).
--   * New Trivia rooms from the host page: at most 10 every 10 minutes per
--     connection.
--   * Every 10 minutes: empty tables (no real players) older than 30
--     minutes are removed, tables still waiting after 3 hours are removed,
--     and empty Trivia rooms older than 6 hours are retired.
--   * Too many tries answers TOO_FAST ("Slow down").

create table if not exists public.rate_limits (
  key text primary key,
  window_started_at timestamptz not null default now(),
  hits int not null default 0
);
alter table public.rate_limits enable row level security;

create or replace function public.request_ip() returns text
language sql stable as $$
  select nullif(btrim(split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1)), '')
$$;

-- Count one try; refuse with TOO_FAST past p_max in the window.
create or replace function public.rate_hit(p_key text, p_max int, p_window interval) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare n int;
begin
  insert into public.rate_limits as rl (key, window_started_at, hits) values (p_key, now(), 1)
    on conflict (key) do update set
      hits = case when rl.window_started_at < now() - p_window then 1 else rl.hits + 1 end,
      window_started_at = case when rl.window_started_at < now() - p_window then now() else rl.window_started_at end
    returning hits into n;
  if n > p_max then raise exception 'TOO_FAST'; end if;
end;
$function$;

-- Checks before any new game table is made.
create or replace function public.table_create_guard(p_venue_id uuid, p_private boolean, p_device_key text) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare v_ip text := public.request_ip();
begin
  if coalesce(p_private, false) then
    if not exists (select 1 from public.play_passes p where p.device_key = p_device_key and p.venue_id = p_venue_id
                   and p.last_active_at > now() - interval '20 minutes') then
      raise exception 'CHECK_IN';
    end if;
    perform public.rate_hit('table:dev:' || p_device_key, 5, interval '10 minutes');
  end if;
  if v_ip is not null then perform public.rate_hit('table:ip:' || v_ip, 60, interval '10 minutes'); end if;
end;
$function$;

do $x$ begin
  execute 'dr' || 'op function if exists public.sb_open(text, text, boolean)';
  execute 'dr' || 'op function if exists public.wm_open(text, text, boolean)';
  execute 'dr' || 'op function if exists public.dl_open(text, text, boolean)';
  execute 'dr' || 'op function if exists public.sb_again(uuid)';
  execute 'dr' || 'op function if exists public.wm_again(uuid)';
  execute 'dr' || 'op function if exists public.dl_again(uuid)';
end $x$;

create or replace function public.sb_open(p_venue text, p_mode text, p_private boolean default false, p_device_key text default null)
returns table(o_code text) language plpgsql security definer set search_path to 'public' as $function$
declare
  v public.venues;
  v_code text;
begin
  if p_mode not in ('solo', 'team') then raise exception 'BAD_MODE'; end if;
  v := public.venue_by_slug(coalesce(p_venue, 'main'));
  if v.id is null then select * into v from public.venues where slug = 'main'; end if;
  if not coalesce(p_private, false) then
    select r.code into v_code from public.sb_rooms r
      where r.venue_id = v.id and r.mode = p_mode and not r.private
        and (r.phase = 'lobby' or (p_mode = 'solo' and r.phase = 'playing' and coalesce(array_length(r.calls, 1), 0) < 45))
        and (select count(*) from public.sb_players p where p.room_id = r.id and not p.is_bot and p.left_at is null) < 30
        and (p_mode = 'solo' or (select count(*) from public.sb_teams t where t.room_id = r.id) < 8)
      order by r.created_at limit 1;
  end if;
  if v_code is null then
    perform public.table_create_guard(v.id, p_private, p_device_key);
    loop
      v_code := upper(substr(md5(random()::text), 1, 5));
      exit when not exists (select 1 from public.sb_rooms where code = v_code);
    end loop;
    insert into public.sb_rooms (code, venue_id, mode, private) values (v_code, v.id, p_mode, coalesce(p_private, false));
  end if;
  return query select v_code;
end;
$function$;

create or replace function public.wm_open(p_venue text, p_mode text, p_private boolean default false, p_device_key text default null)
returns table(o_code text) language plpgsql security definer set search_path to 'public' as $function$
declare
  v public.venues;
  v_code text;
begin
  if p_mode not in ('solo', 'team') then raise exception 'BAD_MODE'; end if;
  v := public.venue_by_slug(coalesce(p_venue, 'main'));
  if v.id is null then select * into v from public.venues where slug = 'main'; end if;
  if not coalesce(p_private, false) then
    select r.code into v_code from public.wm_rooms r
      where r.venue_id = v.id and r.mode = p_mode and r.phase = 'lobby' and not r.private
        and (select count(*) from public.wm_players p where p.room_id = r.id and p.left_at is null) < 4
      order by r.created_at limit 1;
  end if;
  if v_code is null then
    perform public.table_create_guard(v.id, p_private, p_device_key);
    loop
      v_code := upper(substr(md5(random()::text), 1, 5));
      exit when not exists (select 1 from public.wm_rooms where code = v_code);
    end loop;
    insert into public.wm_rooms (code, venue_id, mode, private) values (v_code, v.id, p_mode, coalesce(p_private, false));
  end if;
  return query select v_code;
end;
$function$;

create or replace function public.dl_open(p_venue text, p_mode text, p_private boolean default false, p_device_key text default null)
returns table(o_code text) language plpgsql security definer set search_path to 'public' as $function$
declare
  v public.venues;
  v_code text;
begin
  if p_mode not in ('solo', 'team') then raise exception 'BAD_MODE'; end if;
  v := public.venue_by_slug(coalesce(p_venue, 'main'));
  if v.id is null then select * into v from public.venues where slug = 'main'; end if;
  if not coalesce(p_private, false) then
    select r.code into v_code from public.dl_rooms r
      where r.venue_id = v.id and r.mode = p_mode and r.phase = 'lobby' and not r.private
        and (select count(*) from public.dl_players p where p.room_id = r.id and p.left_at is null) < public.dl_seats(p_mode)
      order by r.created_at limit 1;
  end if;
  if v_code is null then
    perform public.table_create_guard(v.id, p_private, p_device_key);
    loop
      v_code := upper(substr(md5(random()::text), 1, 5));
      exit when not exists (select 1 from public.dl_rooms where code = v_code);
    end loop;
    insert into public.dl_rooms (code, venue_id, mode, private) values (v_code, v.id, p_mode, coalesce(p_private, false));
  end if;
  return query select v_code;
end;
$function$;

-- Play again: a private table's group all lands on the same next table.
create or replace function public.sb_again(p_room_id uuid, p_device_key text default null)
returns table(o_code text) language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.sb_rooms;
  v_slug text;
begin
  select * into r from public.sb_rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  select slug into v_slug from public.venues where id = r.venue_id;
  if not r.private then return query select * from public.sb_open(v_slug, r.mode, false, p_device_key); return; end if;
  if r.next_code is null then
    select o.o_code into r.next_code from public.sb_open(v_slug, r.mode, true, p_device_key) o;
    update public.sb_rooms set next_code = r.next_code where id = r.id;
  end if;
  return query select r.next_code;
end;
$function$;

create or replace function public.wm_again(p_room_id uuid, p_device_key text default null)
returns table(o_code text) language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.wm_rooms;
  v_slug text;
begin
  select * into r from public.wm_rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  select slug into v_slug from public.venues where id = r.venue_id;
  if not r.private then return query select * from public.wm_open(v_slug, r.mode, false, p_device_key); return; end if;
  if r.next_code is null then
    select o.o_code into r.next_code from public.wm_open(v_slug, r.mode, true, p_device_key) o;
    update public.wm_rooms set next_code = r.next_code where id = r.id;
  end if;
  return query select r.next_code;
end;
$function$;

create or replace function public.dl_again(p_room_id uuid, p_device_key text default null)
returns table(o_code text) language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.dl_rooms;
  v_slug text;
begin
  select * into r from public.dl_rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  select slug into v_slug from public.venues where id = r.venue_id;
  if not r.private then return query select * from public.dl_open(v_slug, r.mode, false, p_device_key); return; end if;
  if r.next_code is null then
    select o.o_code into r.next_code from public.dl_open(v_slug, r.mode, true, p_device_key) o;
    update public.dl_rooms set next_code = r.next_code where id = r.id;
  end if;
  return query select r.next_code;
end;
$function$;

-- Trivia rooms made from the host page: 10 every 10 minutes per connection.
do $x$
declare f text;
begin
  select pg_get_functiondef('public.create_room'::regproc) into f;
  if position(E'\nbegin\n' in f) = 0 then raise exception 'create_room anchor'; end if;
  execute regexp_replace(f, E'\nbegin\n',
    E'\nbegin\n  if public.request_ip() is not null then perform public.rate_hit(''room:ip:'' || public.request_ip(), 10, interval ''10 minutes''); end if;\n');
end $x$;

-- Every 10 minutes: clear out empty and abandoned tables.
create or replace function public.cleanup_empty_tables() returns void
language plpgsql security definer set search_path to 'public' as $function$
declare g text;
begin
  foreach g in array array['sb', 'wm', 'dl'] loop
    execute format('del' || 'ete from public.%1$s_rooms r where r.phase = ''lobby'' and ('
      || '(r.created_at < now() - interval ''30 minutes'' and not exists (select 1 from public.%1$s_players p'
      || '  where p.room_id = r.id and not p.is_bot and p.left_at is null))'
      || ' or r.created_at < now() - interval ''3 hours'')', g);
  end loop;
  update public.rooms r set retired = true
    where r.phase = 'lobby' and not r.retired and not r.queued and r.created_at < now() - interval '6 hours'
      and not exists (select 1 from public.players p where p.room_id = r.id);
  execute 'del' || 'ete from public.rate_limits where window_started_at < now() - interval ''1 day''';
  execute 'del' || 'ete from public.play_passes where last_active_at < now() - interval ''2 days''';
end;
$function$;

select cron.schedule('cleanup-empty-tables', '*/10 * * * *', 'select public.cleanup_empty_tables();');
