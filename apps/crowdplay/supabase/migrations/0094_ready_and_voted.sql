-- The early start needs both: every real player in the lobby has tapped
-- Ready AND voted on a category. Then the countdown jumps to 5 seconds;
-- otherwise it runs out as usual. Bots fill the game at the start as before
-- (trivia_lineup: solo up to 12 under 4 real players, bot teams from 4).
do $patch$
declare d text; n text;
begin
  d := pg_get_functiondef('public.tick()'::regprocedure);
  n := replace(d, $a$        -- Every real player tapped Ready: start in 5 seconds.
        select count(*), count(*) filter (where pl.ready) into v_active, v_done from public.players pl
          where pl.room_id = v_room.id and pl.left_at is null and not pl.is_bot;$a$,
  $a$        -- Every real player tapped Ready and voted on a category: start in 5 seconds.
        select count(*), count(*) filter (where pl.ready and exists (
                 select 1 from public.category_votes cv
                 where cv.player_id = pl.id and cv.room_id = v_room.id and cv.choice_pack_id is not null))
          into v_active, v_done from public.players pl
          where pl.room_id = v_room.id and pl.left_at is null and not pl.is_bot;$a$);
  if n = d then raise exception 'tick patch did not apply'; end if;
  execute n;
end $patch$;
