-- Beta capacity caps: at most 20 teams and 50 solo players per room, counted
-- separately (a room could theoretically hold both pools at their caps at
-- once). "Team" here means team_members ended up non-empty after trimming,
-- matching how the client decides whether to show the teammate roster.
--
-- The room row is locked with `for update` for the duration of the check +
-- insert so two simultaneous joins near the cap can't both slip past the
-- count and overshoot it -- correctness matters here since the whole point
-- is enforcing an exact ceiling, not just a rough one.
create or replace function public.join_room(p_code text, p_nickname text, p_team_members text[] default null::text[])
returns table(player_id uuid, client_token uuid, room_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.rooms;
  v_player public.players;
  v_members text[];
  v_is_team boolean;
  v_existing_count integer;
begin
  select * into v_room from public.rooms where code = upper(p_code) for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.phase <> 'lobby' then
    raise exception 'ROOM_ALREADY_STARTED';
  end if;
  if length(trim(p_nickname)) < 1 or length(p_nickname) > 30 then
    raise exception 'INVALID_NICKNAME';
  end if;

  if p_team_members is not null then
    select array_agg(trim(m)) into v_members
      from unnest(p_team_members) as m
      where length(trim(m)) > 0;
  end if;

  v_is_team := v_members is not null and array_length(v_members, 1) > 0;

  if v_is_team then
    select count(*) into v_existing_count from public.players pl
      where pl.room_id = v_room.id and pl.team_members is not null and array_length(pl.team_members, 1) > 0;
    if v_existing_count >= 20 then
      raise exception 'ROOM_FULL_TEAMS';
    end if;
  else
    select count(*) into v_existing_count from public.players pl
      where pl.room_id = v_room.id and (pl.team_members is null or array_length(pl.team_members, 1) = 0);
    if v_existing_count >= 50 then
      raise exception 'ROOM_FULL_SOLO';
    end if;
  end if;

  insert into public.players (room_id, nickname, team_members)
    values (v_room.id, trim(p_nickname), v_members)
    returning * into v_player;

  return query select v_player.id, v_player.client_token, v_player.room_id;
exception when unique_violation then
  raise exception 'NICKNAME_TAKEN';
end;
$function$;
