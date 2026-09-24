-- Buying an avatar only unlocks it; the player equips it themselves with the
-- Equip button (same as free avatars).
do $$
declare
  v_def text;
  v_old text := '    if v_p.player_id is not null then
      update public.players set avatar_id = v_p.item_id where id = v_p.player_id;
    end if;
';
begin
  v_def := pg_get_functiondef('public.complete_purchase(uuid, text, boolean, text, text, boolean, text)'::regprocedure);
  if position(v_old in v_def) = 0 then
    raise exception 'complete_purchase() auto-equip block not found';
  end if;
  execute replace(v_def, v_old, '');
end;
$$;
