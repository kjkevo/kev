-- A team game holds 8 teams of 4 real players (32); past that join_room
-- turns people away, but "has space" used the 40-player room limit, so the
-- next team lobby never opened (found by the load test). Team: under 32
-- real players and under the room limit.
create or replace function public.trivia_room_has_space(p_room_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select case when r.mode = 'solo'
    then (select count(*) from public.players pl where pl.room_id = r.id and pl.left_at is null and not pl.is_bot) < 30
    else (select count(*) from public.players pl where pl.room_id = r.id and pl.left_at is null and not pl.is_bot) < 32
         and not public.trivia_room_full(r.id) end
  from public.rooms r where r.id = p_room_id;
$function$;
