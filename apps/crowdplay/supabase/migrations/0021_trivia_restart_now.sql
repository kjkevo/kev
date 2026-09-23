-- TESTING MODE: solo/small-scale testing means waiting out a full 20
-- question round (10 minutes) plus the final dwell just to get back to a
-- fresh lobby is way too slow to iterate against. Retires whatever room(s)
-- are currently active and immediately boards a new one (5s to lobby,
-- matching the normal boarding feel) so a tester can jump straight to a
-- clean game on demand. Callable by anyone, no host auth -- this is purely
-- a testing convenience.
-- REVERT BEFORE REAL BAR SERVICE: remove this function and the "Start New
-- Game" button in TriviaLandingClient.tsx that calls it, so a random
-- player can't cut a real game short for everyone else.

create or replace function public.restart_trivia_now()
returns table(room_id uuid, code text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room_id uuid;
  v_code text;
begin
  update public.rooms set retired = true where not retired;

  select cr.room_id, cr.code into v_room_id, v_code
    from public.create_room(now() + make_interval(secs => 5)) cr;

  return query select v_room_id, v_code;
end;
$function$;

grant execute on function public.restart_trivia_now() to anon, authenticated;
