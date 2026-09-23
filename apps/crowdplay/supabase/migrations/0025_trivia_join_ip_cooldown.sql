-- Ballot-stuffing mitigation: a per-IP cooldown between successful joins so
-- one person can't stack a team's "majority" vote by rapidly rejoining
-- under new nicknames (new incognito tab, cleared localStorage, etc). This
-- is deliberately light -- it doesn't block a group of friends sharing one
-- bar's wifi from all joining, just rapid-fire rejoining from the same
-- connection. The IP comes from the `request.headers` GUC PostgREST sets
-- on every HTTP call (x-forwarded-for, as set by Supabase's gateway); when
-- that's unavailable (e.g. a direct SQL call, or a header shape we didn't
-- expect) the check is skipped entirely rather than blocking real joins.

create table if not exists public.join_rate_limits (
  ip text primary key,
  last_join_at timestamptz not null default now()
);
alter table public.join_rate_limits enable row level security;

create or replace function public.join_room(
  p_code text,
  p_nickname text,
  p_team_id uuid default null,
  p_new_team_name text default null
)
returns table(player_id uuid, client_token uuid, room_id uuid, team_id uuid, team_name text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.rooms;
  v_player public.players;
  v_team_id uuid;
  v_team_name text;
  v_member_count int;
  v_locked boolean;
  v_ip text;
begin
  select * into v_room from public.rooms where code = upper(p_code) for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.phase <> 'lobby' then
    raise exception 'ROOM_ALREADY_STARTED';
  end if;

  v_ip := nullif(trim(split_part(
    coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''),
    ',', 1
  )), '');
  if v_ip is not null and exists (
    select 1 from public.join_rate_limits jrl
    where jrl.ip = v_ip and jrl.last_join_at > now() - interval '5 seconds'
  ) then
    raise exception 'TOO_MANY_JOINS';
  end if;

  if length(trim(p_nickname)) < 1 or length(p_nickname) > 30 then
    raise exception 'INVALID_NICKNAME';
  end if;

  if p_new_team_name is not null and length(trim(p_new_team_name)) > 0 then
    if length(trim(p_new_team_name)) > 30 then
      raise exception 'INVALID_TEAM_NAME';
    end if;
    if exists (select 1 from public.teams t where t.room_id = v_room.id and t.name = trim(p_new_team_name)) then
      raise exception 'TEAM_NAME_TAKEN';
    end if;
    insert into public.teams (room_id, name, kind) values (v_room.id, trim(p_new_team_name), 'self')
      returning id, name into v_team_id, v_team_name;

  elsif p_team_id is not null then
    select t.id, t.name, t.locked into v_team_id, v_team_name, v_locked
      from public.teams t where t.id = p_team_id and t.room_id = v_room.id for update;
    if v_team_id is null then
      raise exception 'TEAM_NOT_FOUND';
    end if;
    if v_locked then
      raise exception 'TEAM_LOCKED';
    end if;
    select count(*) into v_member_count from public.players pl
      where pl.team_id = v_team_id and pl.left_at is null;
    if v_member_count >= 4 then
      raise exception 'TEAM_FULL';
    end if;

  else
    select o_team_id, o_team_name into v_team_id, v_team_name from public.auto_bucket_team(v_room.id);
  end if;

  insert into public.players (room_id, nickname, team_id)
    values (v_room.id, trim(p_nickname), v_team_id)
    returning * into v_player;

  if v_ip is not null then
    insert into public.join_rate_limits (ip, last_join_at) values (v_ip, now())
      on conflict (ip) do update set last_join_at = excluded.last_join_at;
  end if;

  return query select v_player.id, v_player.client_token, v_player.room_id, v_team_id, v_team_name;
exception when unique_violation then
  raise exception 'NICKNAME_TAKEN';
end;
$function$;
