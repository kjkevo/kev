-- Shoutouts: no paid chat. Every player gets the same 5 free presets (plain
-- text, no emojis), from encouraging to teasing, and can use each one at most 3 times per game.
-- The 10-second delay and venue off switch stay; the gap between any two
-- shoutouts from one player drops to 10 seconds.

update public.shoutout_presets set active = false;
insert into public.shoutout_presets (id, text, price_cents, active, sort) values
  ('go-team', 'Let''s go, team!', 0, true, 1),
  ('got-this', 'You got this!', 0, true, 2),
  ('big-brain', 'Big brain energy', 0, true, 3),
  ('final-answer', 'Is that your final answer?', 0, true, 4),
  ('slowpokes', 'Keep up, slowpokes!', 0, true, 5)
  on conflict (id) do update set text = excluded.text, price_cents = 0, active = true, sort = excluded.sort;

create or replace function public.send_shoutout(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_preset_id text)
returns table(o_show_at timestamptz)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_room public.rooms;
  v_text text;
  v_show timestamptz;
  v_max_uses constant int := 3;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found or v_room.retired then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if not exists (select 1 from public.players pl where pl.id = p_player_id and pl.room_id = p_room_id
                 and pl.client_token = p_client_token and pl.left_at is null) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if not (select shoutouts_enabled from public.venues where id = v_room.venue_id) then
    raise exception 'SHOUTOUTS_OFF';
  end if;
  select text into v_text from public.shoutout_presets where id = p_preset_id and active;
  if v_text is null then
    raise exception 'SHOUTOUT_NOT_FOUND';
  end if;
  perform 1 from public.players where id = p_player_id for update; -- one send at a time per player
  if (select count(*) from public.shoutouts s where s.player_id = p_player_id and s.preset_id = p_preset_id) >= v_max_uses then
    raise exception 'SHOUTOUT_USED_UP';
  end if;
  if exists (select 1 from public.shoutouts s where s.player_id = p_player_id and s.created_at > now() - interval '10 seconds') then
    raise exception 'SHOUTOUT_TOO_SOON';
  end if;
  insert into public.shoutouts (room_id, venue_id, player_id, preset_id, text)
    values (p_room_id, v_room.venue_id, p_player_id, p_preset_id, v_text)
    returning show_at into v_show;
  return query select v_show;
end;
$function$;

-- How many of each preset this player has left in this game.
create or replace function public.my_shoutouts_left(p_room_id uuid, p_player_id uuid, p_client_token uuid)
returns table(o_preset_id text, o_text text, o_left int)
language plpgsql stable security definer set search_path to 'public' as $function$
begin
  if not exists (select 1 from public.players pl where pl.id = p_player_id and pl.room_id = p_room_id
                 and pl.client_token = p_client_token) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  return query
    select p.id, p.text, greatest(0, 3 - (select count(*) from public.shoutouts s
                                          where s.player_id = p_player_id and s.preset_id = p.id))::int
    from public.shoutout_presets p where p.active order by p.sort;
end;
$function$;
grant execute on function public.my_shoutouts_left(uuid, uuid, uuid) to anon, authenticated;

-- Shoutouts are no longer sold.
do $$
declare
  v_def text;
  v_old text := '  elsif p_item_type = ''shoutout'' then
    select text, price_cents into v_name, v_price from public.shoutout_presets where id = p_item_id and active;
';
begin
  v_def := pg_get_functiondef('public.start_purchase(text, text, text, text, text, uuid, uuid, uuid)'::regprocedure);
  if position(v_old in v_def) = 0 then
    raise exception 'start_purchase() shoutout branch not found';
  end if;
  execute replace(v_def, v_old, '');
end;
$$;
