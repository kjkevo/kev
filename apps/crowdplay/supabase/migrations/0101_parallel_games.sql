-- Ready for rushes.
-- Team Play: games run side by side instead of queuing. Each venue always
-- has one open team lobby with space; the moment it starts (or fills up),
-- the next one opens, so nobody waits behind a game in progress. The wait
-- is at most one lobby countdown.
-- Solo: a solo game takes up to 30 real players; when the open one has 30,
-- a second solo game opens beside it for new arrivals.

-- Does this game still take new players? Solo: under 30 real players.
-- Team: under the 40-player room limit.
create or replace function public.trivia_room_has_space(p_room_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select case when r.mode = 'solo'
    then (select count(*) from public.players pl where pl.room_id = r.id and pl.left_at is null and not pl.is_bot) < 30
    else not public.trivia_room_full(r.id) end
  from public.rooms r where r.id = p_room_id;
$function$;

do $patch$
declare d text; n text; a int;
begin
  -- tick: the per-venue part, rewritten.
  d := pg_get_functiondef('public.tick()'::regprocedure);
  a := position('  for v_venue in select ve.id from public.venues ve where ve.active and not ve.asleep loop' in d);
  if a = 0 then raise exception 'tick anchor not found'; end if;
  n := substring(d from 1 for a - 1) || $tail$  for v_venue in select ve.id from public.venues ve where ve.active and not ve.asleep loop
    -- Team Play: always one open team lobby with space. Games run side by
    -- side, so the next lobby opens as soon as this one starts or fills.
    if not exists (select 1 from public.rooms r where r.venue_id = v_venue.id and not r.retired and not r.queued
                   and r.mode = 'team' and r.phase = 'lobby' and public.trivia_room_has_space(r.id)) then
      v_next := null;
      select r.id into v_next from public.rooms r
        where r.venue_id = v_venue.id and not r.retired and r.queued
        order by r.queued_at, r.created_at limit 1
        for update skip locked;
      if v_next is not null then
        update public.rooms set queued = false, phase_started_at = now(),
          starts_at = now() + make_interval(secs => v_lobby_boarding_seconds)
          where id = v_next;
      else
        perform public.create_room(now() + make_interval(secs => v_lobby_boarding_seconds), v_venue.id);
      end if;
    end if;

    -- Solo: always one solo game with space; a full one gets a sister game.
    if not exists (select 1 from public.rooms r where r.venue_id = v_venue.id and not r.retired and r.mode = 'solo'
                   and r.phase <> 'final' and public.trivia_room_has_space(r.id)) then
      select cr.room_id into v_next from public.create_room(now() + make_interval(secs => v_lobby_boarding_seconds), v_venue.id) cr;
      update public.rooms set mode = 'solo' where id = v_next;
    end if;
  end loop;
end;
$function$
$tail$;
  execute n;

  -- Watchdog: several games at once is normal now; only two open lobbies
  -- with space (of the same kind) count as duplicates.
  d := pg_get_functiondef('public.ops_watchdog()'::regprocedure);
  n := replace(d,
    'where not r.retired and not r.queued and r.phase <> ''final'' and r.id <> (select r2.id from public.rooms r2 where not r2.retired and not r2.queued and r2.venue_id = r.venue_id and r2.mode = r.mode order by',
    'where not r.retired and not r.queued and r.phase = ''lobby'' and public.trivia_room_has_space(r.id) and r.id <> (select r2.id from public.rooms r2 where not r2.retired and not r2.queued and r2.venue_id = r.venue_id and r2.mode = r.mode and r2.phase = ''lobby'' and public.trivia_room_has_space(r2.id) order by');
  if n = d then raise exception 'ops_watchdog patch did not apply'; end if;
  execute n;
end $patch$;
