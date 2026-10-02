-- Never "name taken in this game":
-- * Someone who left a game (often the same person tapping Back, then
--   joining again) no longer holds on to their name: their old seat is
--   renamed "Name ·abcd" so the name is free.
-- * Usernames are unique for the month, so two real players can't share
--   one. If a clash ever slips through anyway, the newcomer gets "Name 2"
--   instead of an error.
do $$
declare d text; n int;
begin
  d := pg_get_functiondef('public.join_room'::regproc);
  n := length(d);
  d := replace(d,
    E'  if exists (select 1 from public.players pl where pl.room_id = v_room.id and lower(pl.nickname) = lower(trim(p_nickname))) then\n    raise exception ''NICKNAME_TAKEN'';\n  end if;\n',
    E'  update public.players pl set nickname = left(pl.nickname, 22) || '' ·'' || left(pl.id::text, 4)\n    where pl.room_id = v_room.id and pl.left_at is not null and lower(pl.nickname) = lower(trim(p_nickname));\n  v_nick := trim(p_nickname);\n  v_try := 1;\n  while exists (select 1 from public.players pl where pl.room_id = v_room.id and lower(pl.nickname) = lower(v_nick)) loop\n    v_try := v_try + 1;\n    v_nick := left(trim(p_nickname), 27) || '' '' || v_try;\n  end loop;\n');
  d := replace(d, E'values (v_room.id, trim(p_nickname), v_team_id,', E'values (v_room.id, v_nick, v_team_id,');
  d := replace(d, E'  v_ip text;\nbegin', E'  v_ip text;\n  v_nick text;\n  v_try int;\nbegin');
  if length(d) = n or position('v_nick, v_team_id' in d) = 0 or position('v_try int;' in d) = 0 then
    raise exception 'join_room patch did not apply';
  end if;
  execute d;

  d := pg_get_functiondef('public.rejoin_next_game'::regproc);
  n := length(d);
  d := replace(d,
    E'  if exists (select 1 from public.players pl where pl.room_id = v_target.id and lower(pl.nickname) = lower(v_old.nickname)) then',
    E'  update public.players pl set nickname = left(pl.nickname, 22) || '' ·'' || left(pl.id::text, 4)\n    where pl.room_id = v_target.id and pl.left_at is not null and lower(pl.nickname) = lower(v_old.nickname);\n  if exists (select 1 from public.players pl where pl.room_id = v_target.id and lower(pl.nickname) = lower(v_old.nickname)) then');
  if length(d) = n then
    raise exception 'rejoin_next_game patch did not apply';
  end if;
  execute d;
end $$;
