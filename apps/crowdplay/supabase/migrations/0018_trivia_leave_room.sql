-- Lets a trivia player leave a room they've already joined, without losing
-- the score they already earned. "Left" is a soft flag (left_at timestamp),
-- not a delete: the leaderboard keeps showing their frozen score (they
-- played fair and earned those points), but every "who's actually here
-- right now" surface -- the lobby roster, the "ready"/"answered" counts,
-- and team/solo capacity -- excludes them going forward, and a spot they
-- occupied frees up for a new joiner. Realtime already pushes the updated
-- row to every subscriber (players, host, the venue screen), so nothing
-- extra is needed for "everyone else finds out" -- that's just a normal
-- postgres_changes update on a row they're already subscribed to.

alter table public.players add column left_at timestamptz;

create or replace function public.leave_room(
  p_room_id uuid,
  p_player_id uuid,
  p_client_token uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.players
    set left_at = now()
    where id = p_player_id and room_id = p_room_id and client_token = p_client_token and left_at is null;
end;
$function$;

-- Same capacity-counting logic as before, just excluding anyone who's left
-- so their spot is usable again.
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
      where pl.room_id = v_room.id and pl.left_at is null
        and pl.team_members is not null and array_length(pl.team_members, 1) > 0;
    if v_existing_count >= 20 then
      raise exception 'ROOM_FULL_TEAMS';
    end if;
  else
    select count(*) into v_existing_count from public.players pl
      where pl.room_id = v_room.id and pl.left_at is null
        and (pl.team_members is null or array_length(pl.team_members, 1) = 0);
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
