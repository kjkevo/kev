-- Lets a host schedule a countdown to kickoff instead of only ever starting
-- instantly, and lets any visitor find "the current game" for the venue
-- without needing a specific room code (single-venue MVP: one Supabase
-- project == one venue, so "most recent non-final room" is unambiguous).

alter table public.rooms add column starts_at timestamptz;

drop function public.create_room(uuid);

create function public.create_room(p_pack_id uuid, p_starts_at timestamptz default null)
returns table(room_id uuid, code text, host_secret uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_room public.rooms;
  v_secret uuid;
begin
  loop
    v_code := upper(substr(md5(random()::text), 1, 5));
    begin
      insert into public.rooms (code, pack_id, starts_at) values (v_code, p_pack_id, p_starts_at)
      returning * into v_room;
      exit;
    exception when unique_violation then
    end;
  end loop;

  insert into public.room_hosts (room_id) values (v_room.id)
    returning room_hosts.host_secret into v_secret;

  return query select v_room.id, v_room.code, v_secret;
end;
$$;

grant execute on function public.create_room(uuid, timestamptz) to anon, authenticated;
