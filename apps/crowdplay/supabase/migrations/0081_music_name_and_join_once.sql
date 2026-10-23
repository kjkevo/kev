-- "Music & Audio Rounds" is now just "Music".
update public.question_packs set name = 'Music' where id = 'c0250e17-61cb-4320-9ac0-13b945244fbf';

-- join_room: the same phone joining the same game twice (double tap, retry)
-- gets its existing spot back instead of a second one ("Name 2").
do $$
declare d text;
begin
  d := pg_get_functiondef('public.join_room'::regproc);
  d := replace(d, $o$  perform public.check_avatar(p_avatar_id, p_device_key);
$o$, $n$  perform public.check_avatar(p_avatar_id, p_device_key);

  -- The same phone joining twice (double tap, retry) gets its existing spot.
  if nullif(p_device_key, '') is not null then
    select * into v_player from public.players pl
      where pl.room_id = v_room.id and pl.device_key = p_device_key and pl.left_at is null and not pl.is_bot
      order by pl.joined_at limit 1;
    if found then
      return query select v_player.id, v_player.client_token, v_player.room_id, v_player.team_id,
        (select t.name from public.teams t where t.id = v_player.team_id);
      return;
    end if;
  end if;
$n$);
  if position('gets its existing spot' in d) = 0 then raise exception 'join_room patch did not apply'; end if;
  execute d;
end $$;
