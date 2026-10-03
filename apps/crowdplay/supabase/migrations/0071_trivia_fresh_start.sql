-- Opening trivia never makes a real player wait behind a game nobody real
-- is playing: a running game with only bots (or nobody) left in it ends,
-- and the next lobby boards with a fresh countdown on the next tick.
-- Games with real players in them are never touched.
create or replace function public.trivia_fresh_start(p_venue text)
returns boolean
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_venue public.venues;
  v_room record;
  v_done boolean := false;
begin
  v_venue := public.venue_by_slug(p_venue);
  if v_venue.id is null then
    return false;
  end if;
  for v_room in
    select r.id from public.rooms r
    where r.venue_id = v_venue.id and not r.retired and not r.queued and r.phase <> 'lobby'
      and not exists (select 1 from public.players pl where pl.room_id = r.id and pl.left_at is null and not pl.is_bot)
  loop
    update public.rooms set retired = true, phase = 'final', phase_started_at = now() where id = v_room.id;
    v_done := true;
  end loop;
  return v_done;
end;
$function$;
grant execute on function public.trivia_fresh_start(text) to anon, authenticated;
