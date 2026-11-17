-- Push instead of poll for Bingo, Wild Match and Drop Line.
-- Phones used to ask for the table's state every second. Now, whenever a
-- table changes (a move, a called number, someone joining, a bot's turn), the
-- server sends one small "changed" message on that table's Realtime channel
-- ("dl:<room id>", "wm:<room id>", "sb:<room id>"); phones fetch the state
-- only then (plus a slow safety check). The message carries no game data
-- (hands stay private: phones still fetch their own state). At most one
-- message per table per database transaction, however many rows changed.

create or replace function public.table_ping() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_game text := TG_ARGV[0];
  v_room uuid;
  v_flag text;
begin
  v_room := (case when TG_TABLE_NAME like '%_rooms' then to_jsonb(new)->>'id' else to_jsonb(new)->>'room_id' end)::uuid;
  if v_room is null then return null; end if;
  v_flag := 'slimpse.ping_' || v_game || '_' || replace(v_room::text, '-', '');
  if current_setting(v_flag, true) = '1' then return null; end if;
  perform set_config(v_flag, '1', true);
  begin
    perform realtime.send(jsonb_build_object('t', extract(epoch from clock_timestamp())), 'changed', v_game || ':' || v_room::text, false);
  exception when others then
    null; -- never let a missed message break a move (phones still check every few seconds)
  end;
  return null;
end;
$function$;

do $x$
declare t text; g text;
begin
  foreach t in array array['dl_rooms', 'dl_players', 'wm_rooms', 'wm_players', 'sb_rooms', 'sb_teams', 'sb_players'] loop
    g := split_part(t, '_', 1);
    execute format('dr' || 'op trigger if exists %I on public.%I', t || '_ping', t);
    execute format('create trigger %I after insert or update on public.%I for each row execute function public.table_ping(%L)',
      t || '_ping', t, g);
  end loop;
end $x$;
