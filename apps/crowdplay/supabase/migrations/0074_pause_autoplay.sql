-- Pause autoplay: games no longer run on their own. A lobby waits (no
-- countdown) until a real player joins; then the countdown starts. Test bots
-- stop filling lobbies. To turn autoplay back on:
--   update public.feature_flags set enabled = true where key = 'trivia_autoplay';
--   update public.venues set test_bots = true where slug = 'main';
insert into public.feature_flags (key, enabled) values ('trivia_autoplay', false)
  on conflict (key) do update set enabled = excluded.enabled;

update public.venues set test_bots = false;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.tick'::regproc);
  d := replace(d,
$old$    if v_room.phase = 'lobby' and v_room.starts_at is not null then
      if v_room.starts_at <= now() then$old$,
$new$    if v_room.phase = 'lobby' and not public.feature_on('trivia_autoplay')
       and not exists (select 1 from public.players pl
                       where pl.room_id = v_room.id and pl.left_at is null and not pl.is_bot) then
      -- Paused: nobody real here yet, so no countdown.
      if v_room.starts_at is not null then
        update public.rooms set starts_at = null where id = v_room.id;
      end if;

    elsif v_room.phase = 'lobby' and v_room.starts_at is null and not public.feature_on('trivia_autoplay') then
      -- First real player joined: start the countdown.
      update public.rooms set starts_at = now() + make_interval(secs => v_lobby_boarding_seconds)
        where id = v_room.id;

    elsif v_room.phase = 'lobby' and v_room.starts_at is not null then
      if v_room.starts_at <= now() then$new$);
  if position('trivia_autoplay' in d) = 0 then
    raise exception 'tick patch did not apply';
  end if;
  execute d;
end $$;
