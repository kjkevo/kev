-- TESTING MODE: solo/small-scale testing means rounds run with nobody
-- playing most of the time, and the normal ~20s lobby-only join window is
-- too easy to miss. Temporarily removes the "phase must be lobby" gate from
-- both join RPCs so a join always works regardless of what phase the room
-- is in -- joining mid-round just means starting to participate from
-- whatever's happening right now.
--
-- REVERT BEFORE REAL BAR SERVICE: mid-round joins need to stay blocked for
-- real players so everyone starts on equal footing (that's the whole
-- reason ROOM_ALREADY_STARTED exists). To revert, restore the
-- `if v_room.phase <> 'lobby' then raise exception 'ROOM_ALREADY_STARTED';`
-- check removed below in both functions, and revert canJoinNow in
-- TriviaLandingClient.tsx / FeudLandingClient.tsx back to
-- `room !== null && room.phase === "lobby"`.
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

create or replace function public.join_feud_room(p_code text, p_nickname text, p_team text default null)
returns table(player_id uuid, client_token uuid, room_id uuid, team text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.feud_rooms;
  v_player public.feud_players;
  v_team text;
  v_team_a_count int;
  v_team_b_count int;
begin
  select * into v_room from public.feud_rooms where code = upper(p_code) for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if length(trim(p_nickname)) < 1 or length(p_nickname) > 30 then
    raise exception 'INVALID_NICKNAME';
  end if;

  select count(*) filter (where pl.team = 'a'), count(*) filter (where pl.team = 'b')
    into v_team_a_count, v_team_b_count
    from public.feud_players pl where pl.room_id = v_room.id;

  if v_team_a_count >= 25 and v_team_b_count >= 25 then
    raise exception 'ROOM_FULL';
  end if;

  if p_team in ('a', 'b') and (case when p_team = 'a' then v_team_a_count else v_team_b_count end) < 25 then
    v_team := p_team;
  else
    v_team := case
      when v_team_a_count >= 25 then 'b'
      when v_team_b_count >= 25 then 'a'
      when v_team_a_count <= v_team_b_count then 'a'
      else 'b'
    end;
  end if;

  insert into public.feud_players (room_id, team, nickname)
    values (v_room.id, v_team, trim(p_nickname))
    returning * into v_player;

  return query select v_player.id, v_player.client_token, v_player.room_id, v_player.team;
exception when unique_violation then
  raise exception 'NICKNAME_TAKEN';
end;
$function$;
