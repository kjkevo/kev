-- "Team up" in the lobby: a player can start a team for friends, join
-- another real player's team (up to 4), or go back to solo. Teams made this
-- way are kind 'self', and the lineup now keeps them together even with
-- fewer than 4 real players (before, everyone was split up into solo play).

create or replace function public.set_player_team(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_action text, p_team_id uuid default null)
returns table(team_id uuid, team_name text)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_old uuid;
  v_new uuid;
begin
  if not exists (select 1 from public.rooms r where r.id = p_room_id and r.phase = 'lobby') then
    raise exception 'NOT_IN_LOBBY';
  end if;
  select pl.team_id into v_old from public.players pl
    where pl.id = p_player_id and pl.room_id = p_room_id and pl.client_token = p_client_token
      and pl.left_at is null and not pl.is_bot
    for update;
  if not found then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if p_action = 'join' then
    perform 1 from public.teams t where t.id = p_team_id and t.room_id = p_room_id for update;
    if not found or exists (select 1 from public.players b where b.team_id = p_team_id and b.is_bot and b.left_at is null) then
      raise exception 'TEAM_NOT_FOUND';
    end if;
    if p_team_id is distinct from v_old
       and (select count(*) from public.players h where h.team_id = p_team_id and h.left_at is null and not h.is_bot) >= 4 then
      raise exception 'TEAM_FULL';
    end if;
    update public.teams set kind = 'self' where id = p_team_id;
    v_new := p_team_id;
  elsif p_action in ('start', 'solo') then
    insert into public.teams (room_id, name, kind)
      values (p_room_id, public.trivia_fun_team_name(p_room_id), case when p_action = 'start' then 'self' else 'auto' end)
      returning id into v_new;
  else
    raise exception 'BAD_ACTION';
  end if;

  update public.players set team_id = v_new where id = p_player_id;
  -- The old team, if now empty, is cleared by the next lineup pass.
  return query select t.id, t.name from public.teams t where t.id = v_new;
end;
$function$;
do $g$ begin execute $q$gr$q$ || $q$ant execute on function public.set_player_team(uuid, uuid, uuid, text, uuid) to anon, authenticated$q$; end $g$;

-- Under 4 real players: keep friends' teams (kind 'self', no bots) together
-- instead of splitting everyone into solo play.
do $patch$
declare d text; n text;
begin
  d := pg_get_functiondef('public.trivia_lineup(uuid, boolean)'::regprocedure);
  n := replace(d,
    '      if r.team_id is null or exists (',
    '      if r.team_id is null or (not exists (select 1 from public.teams ft where ft.id = r.team_id and ft.kind = ''self''
                                             and not exists (select 1 from public.players fb where fb.team_id = ft.id and fb.is_bot and fb.left_at is null))
                               and exists (');
  n := replace(n, 'p2.joined_at <= r.joined_at)) then', 'p2.joined_at <= r.joined_at))) then');
  if n = d or position('ft.kind = ''self''' in n) = 0 or position('r.joined_at))) then' in n) = 0 then
    raise exception 'trivia_lineup patch did not apply';
  end if;
  execute n;
end $patch$;
