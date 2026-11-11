-- Private tables for Bingo, Wild Match and the 4-in-a-row game.
-- Public play already opens a new table whenever the open one fills up, so
-- any number of games run at once. A private table is just for one group:
-- strangers are never matched into it, only people with its invite QR code
-- can join, empty seats get computer players when it starts, and it waits
-- for the group (no 45 second clock) until someone taps Start (or every
-- seat has a real player). "Play again" keeps the group together: the first
-- person to tap it makes the next table and everyone else follows.

alter table public.sb_rooms add column if not exists private boolean not null default false;
alter table public.sb_rooms add column if not exists next_code text;
alter table public.wm_rooms add column if not exists private boolean not null default false;
alter table public.wm_rooms add column if not exists next_code text;
alter table public.dl_rooms add column if not exists private boolean not null default false;
alter table public.dl_rooms add column if not exists next_code text;

do $x$
declare
  g text;
  f text;
  v_new text;
  v_join_guard text;
begin
  -- The old 2-argument open functions are replaced by 3-argument ones below.
  foreach g in array array['sb', 'wm', 'dl'] loop
    execute 'dr' || 'op function if exists public.' || g || '_open(text, text)';
  end loop;

  -- Joins: a private table that already started sends latecomers to the
  -- group's next table (or says it started); private tables don't start the
  -- 45 second clock.
  foreach g in array array['sb', 'wm', 'dl'] loop
    select pg_get_functiondef(oid) into f from pg_proc where proname = g || '_join' and pronamespace = 'public'::regnamespace;
    v_join_guard := 'if not found then raise exception ''ROOM_NOT_FOUND''; end if;
  if r.private and r.phase <> ''lobby'' and not exists (select 1 from public.' || g || '_players p
      where p.room_id = r.id and p.device_key = p_device_key and not p.is_bot) then
    if r.next_code is not null then raise exception ''MOVED_TO_%'', r.next_code; end if;
    raise exception ''PRIVATE_STARTED'';
  end if;';
    if position('if not found then raise exception ''ROOM_NOT_FOUND''; end if;' in f) = 0 then raise exception 'anchor 1 missing in %', g; end if;
    v_new := replace(f, 'if not found then raise exception ''ROOM_NOT_FOUND''; end if;', v_join_guard);
    if g = 'sb' then
      if position('if r.phase = ''lobby'' and r.starts_at is null then' in v_new) = 0 then raise exception 'anchor 2 missing in sb'; end if;
      v_new := replace(v_new, 'if r.phase = ''lobby'' and r.starts_at is null then', 'if r.phase = ''lobby'' and r.starts_at is null and not r.private then');
    else
      if position('else coalesce(starts_at, now() + interval ''45 seconds'') end' in v_new) = 0 then raise exception 'anchor 2 missing in %', g; end if;
      v_new := replace(v_new, 'else coalesce(starts_at, now() + interval ''45 seconds'') end',
        'else case when r.private then starts_at else coalesce(starts_at, now() + interval ''45 seconds'') end end');
    end if;
    execute v_new;

    -- State: tell the page whether the table is private and where the group went next.
    select pg_get_functiondef(oid) into f from pg_proc where proname = g || '_state' and pronamespace = 'public'::regnamespace;
    if position('''venue'', (select slug' in f) = 0 then raise exception 'anchor 3 missing in %', g; end if;
    execute replace(f, '''venue'', (select slug', '''private'', r.private, ''next_code'', r.next_code, ''venue'', (select slug');
  end loop;
end $x$;

-- Open: public finds the open table (or makes one); private always makes a new one.
create or replace function public.sb_open(p_venue text, p_mode text, p_private boolean default false)
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
    loop
      v_code := upper(substr(md5(random()::text), 1, 5));
      exit when not exists (select 1 from public.sb_rooms where code = v_code);
    end loop;
    insert into public.sb_rooms (code, venue_id, mode, private) values (v_code, v.id, p_mode, coalesce(p_private, false));
  end if;
  return query select v_code;
end;
$function$;

create or replace function public.wm_open(p_venue text, p_mode text, p_private boolean default false)
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
    loop
      v_code := upper(substr(md5(random()::text), 1, 5));
      exit when not exists (select 1 from public.wm_rooms where code = v_code);
    end loop;
    insert into public.wm_rooms (code, venue_id, mode, private) values (v_code, v.id, p_mode, coalesce(p_private, false));
  end if;
  return query select v_code;
end;
$function$;

create or replace function public.dl_open(p_venue text, p_mode text, p_private boolean default false)
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
create or replace function public.sb_again(p_room_id uuid)
returns table(o_code text) language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.sb_rooms;
  v_slug text;
begin
  select * into r from public.sb_rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  select slug into v_slug from public.venues where id = r.venue_id;
  if not r.private then return query select * from public.sb_open(v_slug, r.mode, false); return; end if;
  if r.next_code is null then
    select o.o_code into r.next_code from public.sb_open(v_slug, r.mode, true) o;
    update public.sb_rooms set next_code = r.next_code where id = r.id;
  end if;
  return query select r.next_code;
end;
$function$;

create or replace function public.wm_again(p_room_id uuid)
returns table(o_code text) language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.wm_rooms;
  v_slug text;
begin
  select * into r from public.wm_rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  select slug into v_slug from public.venues where id = r.venue_id;
  if not r.private then return query select * from public.wm_open(v_slug, r.mode, false); return; end if;
  if r.next_code is null then
    select o.o_code into r.next_code from public.wm_open(v_slug, r.mode, true) o;
    update public.wm_rooms set next_code = r.next_code where id = r.id;
  end if;
  return query select r.next_code;
end;
$function$;

create or replace function public.dl_again(p_room_id uuid)
returns table(o_code text) language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.dl_rooms;
  v_slug text;
begin
  select * into r from public.dl_rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  select slug into v_slug from public.venues where id = r.venue_id;
  if not r.private then return query select * from public.dl_open(v_slug, r.mode, false); return; end if;
  if r.next_code is null then
    select o.o_code into r.next_code from public.dl_open(v_slug, r.mode, true) o;
    update public.dl_rooms set next_code = r.next_code where id = r.id;
  end if;
  return query select r.next_code;
end;
$function$;

-- Start now: anyone at a private table can start it (empty seats get computer players).
create or replace function public.sb_start_now(p_room_id uuid, p_player_id uuid, p_client_token uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not exists (select 1 from public.sb_players where id = p_player_id and room_id = p_room_id and client_token = p_client_token) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  update public.sb_rooms set starts_at = now() + interval '3 seconds'
    where id = p_room_id and private and phase = 'lobby' and (starts_at is null or starts_at > now() + interval '3 seconds');
end;
$function$;

create or replace function public.wm_start_now(p_room_id uuid, p_player_id uuid, p_client_token uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not exists (select 1 from public.wm_players where id = p_player_id and room_id = p_room_id and client_token = p_client_token) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  update public.wm_rooms set starts_at = now() + interval '3 seconds'
    where id = p_room_id and private and phase = 'lobby' and (starts_at is null or starts_at > now() + interval '3 seconds');
end;
$function$;

create or replace function public.dl_start_now(p_room_id uuid, p_player_id uuid, p_client_token uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not exists (select 1 from public.dl_players where id = p_player_id and room_id = p_room_id and client_token = p_client_token) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  update public.dl_rooms set starts_at = now() + interval '3 seconds'
    where id = p_room_id and private and phase = 'lobby' and (starts_at is null or starts_at > now() + interval '3 seconds');
end;
$function$;
