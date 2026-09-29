-- Lobby: bots fill only 2 teams (up to 8 bots, still 12 minus real players),
-- leaving a team spot open for real players who come in as a group.
-- Game start (the get-ready countdown before question 1): if the game has
-- fewer than 12 players, bots join real players' teams first (bringing each
-- up to 4), then the bot teams, until there are 12.

-- Lobby cap: 2 bot teams.
do $$
declare d text; n int;
begin
  d := pg_get_functiondef('public.trivia_bot_fill'::regproc);
  n := length(d);
  d := replace(d, '  v_target := greatest(0, v_fill_to - v_humans);',
                  E'  -- Two bot teams at most while boarding: the third spot is for real players.\n  v_target := least(2 * v_bot_team_size, greatest(0, v_fill_to - v_humans));');
  if length(d) = n then raise exception 'trivia_bot_fill patch did not apply'; end if;
  execute d;
end $$;

create or replace function public.trivia_bot_topup(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_fill_to constant int := 12;
  v_team_target constant int := 4;
  v_names constant text[] := array['Ava','Ben','Cleo','Dev','Fay','Gus','Hana','Ivan','Jo','Kai','Lou','Max',
                                   'Nia','Oscar','Priya','Quinn','Rosa','Sam','Theo','Uma','Vince','Wes','Yara','Zoe'];
  v_room public.rooms;
  v_bots_on boolean;
  v_need int;
  v_team uuid;
  v_name text;
  v_new uuid;
begin
  select * into v_room from public.rooms where id = p_room_id;
  select ve.test_bots into v_bots_on from public.venues ve where ve.id = v_room.venue_id and ve.active;
  if not coalesce(v_bots_on, false) or v_room.phase <> 'lobby' then
    return;
  end if;
  select v_fill_to - count(*) into v_need from public.players pl where pl.room_id = p_room_id and pl.left_at is null;

  while v_need > 0 loop
    select n into v_name from unnest(v_names) n
      where not exists (select 1 from public.players pl where pl.room_id = p_room_id and lower(pl.nickname) = lower(n))
      order by random() limit 1;
    exit when v_name is null;
    -- Real players' teams first, smallest first, up to 4.
    v_team := null;
    select t.id into v_team from public.teams t
      where t.room_id = p_room_id and not t.locked
        and exists (select 1 from public.players pl where pl.team_id = t.id and pl.left_at is null and not pl.is_bot)
        and (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null) < v_team_target
      order by (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null), t.created_at
      limit 1;
    -- Then bot teams with room.
    if v_team is null then
      select t.id into v_team from public.teams t
        where t.room_id = p_room_id and not t.locked
          and exists (select 1 from public.players pl where pl.team_id = t.id and pl.left_at is null)
          and not exists (select 1 from public.players pl where pl.team_id = t.id and pl.left_at is null and not pl.is_bot)
          and (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null) < v_team_target
        order by t.created_at limit 1;
    end if;
    begin
      if v_team is not null then
        select player_id into v_new from public.join_room(v_room.code, v_name, v_team, null,
          case when hashtext(v_name) % 2 = 0 then 'jungle-scout' else 'crystal-titan' end, null);
      else
        select player_id into v_new from public.join_room(v_room.code, v_name, null, public.trivia_fun_team_name(p_room_id),
          case when hashtext(v_name) % 2 = 0 then 'jungle-scout' else 'crystal-titan' end, null);
      end if;
      update public.players set is_bot = true where id = v_new;
    exception when others then
      exit; -- room or team limits reached
    end;
    v_need := v_need - 1;
  end loop;
end;
$$;

-- Run the top-up as the game starts, before teams are locked.
do $$
declare d text; n int;
begin
  d := pg_get_functiondef('public.finalize_voting_and_start'::regproc);
  n := length(d);
  d := replace(d, E'  if not found or v_room.phase <> ''lobby'' then\n    return;\n  end if;\n',
                  E'  if not found or v_room.phase <> ''lobby'' then\n    return;\n  end if;\n\n  -- Short of 12 players: bots join real players'' teams first, then bot teams.\n  perform public.trivia_bot_topup(p_room_id);\n');
  if length(d) = n then raise exception 'finalize_voting_and_start patch did not apply'; end if;
  execute d;
end $$;
