-- "Play the next game, same team." From a finished game, move a player into
-- the venue's next open lobby on a team carried over from the one they just
-- played on: the first teammate to tap creates it (same name), the rest land
-- on it. Keeps their username and avatar. Team caps still apply (8 teams,
-- 5 per team).

alter table public.teams add column if not exists carried_from uuid references public.teams(id) on delete set null;
create index if not exists teams_carried_from_idx on public.teams (carried_from) where carried_from is not null;

create or replace function public.rejoin_next_game(p_room_id uuid, p_player_id uuid, p_client_token uuid)
returns table(o_player_id uuid, o_client_token uuid, o_room_id uuid, o_code text, o_team_id uuid, o_team_name text)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_max_team_size constant int := 5;
  v_max_teams constant int := 8;
  v_old public.players;
  v_old_team public.teams;
  v_old_room public.rooms;
  v_target public.rooms;
  v_team public.teams;
  v_name text;
  v_n int := 1;
  v_player public.players;
begin
  select * into v_old from public.players where id = p_player_id and room_id = p_room_id and client_token = p_client_token;
  if not found then
    raise exception 'NOT_AUTHORIZED';
  end if;
  select * into v_old_room from public.rooms where id = p_room_id;
  select * into v_old_team from public.teams where id = v_old.team_id;

  -- Next open lobby at this venue: the live one if it's still boarding,
  -- else the first game in line.
  select r.* into v_target from public.rooms r
    where r.venue_id = v_old_room.venue_id and not r.retired and r.phase = 'lobby' and r.id <> p_room_id
      and not public.trivia_room_full(r.id)
    order by r.queued, r.queued_at nulls first, r.created_at
    limit 1
    for update;
  if v_target.id is null then
    raise exception 'NO_NEXT_GAME';
  end if;

  -- Already moved over (double tap, second phone tab)?
  select pl.* into v_player from public.players pl
    where pl.room_id = v_target.id and pl.left_at is null
      and ((v_old.device_key is not null and pl.device_key = v_old.device_key) or lower(pl.nickname) = lower(v_old.nickname))
    limit 1;
  if v_player.id is not null then
    return query select v_player.id, v_player.client_token, v_target.id, v_target.code, v_player.team_id,
      (select name from public.teams where id = v_player.team_id);
    return;
  end if;

  -- The carried-over team, created by whichever teammate taps first.
  if v_old_team.id is not null then
    select t.* into v_team from public.teams t
      where t.room_id = v_target.id and t.carried_from = v_old_team.id
      for update;
  end if;
  if v_team.id is not null then
    if v_team.locked then
      raise exception 'TEAM_LOCKED';
    end if;
    if (select count(*) from public.players pl where pl.team_id = v_team.id and pl.left_at is null) >= v_max_team_size then
      raise exception 'TEAM_FULL';
    end if;
  else
    if public.trivia_live_team_count(v_target.id) >= v_max_teams then
      raise exception 'TOO_MANY_TEAMS';
    end if;
    v_name := coalesce(v_old_team.name, 'Team ' || public.trivia_live_team_count(v_target.id) + 1);
    while exists (select 1 from public.teams t where t.room_id = v_target.id and lower(t.name) = lower(v_name)) loop
      v_n := v_n + 1;
      v_name := coalesce(v_old_team.name, 'Team') || ' ' || v_n;
    end loop;
    insert into public.teams (room_id, name, kind, carried_from)
      values (v_target.id, v_name, 'self', v_old_team.id)
      returning * into v_team;
  end if;

  if exists (select 1 from public.players pl where pl.room_id = v_target.id and lower(pl.nickname) = lower(v_old.nickname)) then
    raise exception 'NICKNAME_TAKEN';
  end if;
  insert into public.players (room_id, nickname, team_id, avatar_id, device_key)
    values (v_target.id, v_old.nickname, v_team.id, v_old.avatar_id, v_old.device_key)
    returning * into v_player;

  return query select v_player.id, v_player.client_token, v_target.id, v_target.code, v_team.id, v_team.name;
end;
$function$;
grant execute on function public.rejoin_next_game(uuid, uuid, uuid) to anon, authenticated;
