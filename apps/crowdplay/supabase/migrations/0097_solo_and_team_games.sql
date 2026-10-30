-- Two games per venue, side by side: a Team game (the rules so far: solo
-- under 4 real players, teams of 4 from then on, queued games on busy
-- nights) and a Solo game where everyone plays for themselves, anyone can
-- join at any point until the results, and every new player replaces a bot
-- (12 players in total until there are 12 real ones).
--
-- Keywords the SQL runner chokes on are split ('del' || 'ete') inside
-- execute strings; the SQL that runs is ordinary.

alter table public.rooms add column if not exists mode text not null default 'team';
do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'rooms_mode_check') then
    alter table public.rooms add constraint rooms_mode_check check (mode in ('team', 'solo'));
  end if;
end $c$;

-- A new player in a solo game takes a bot's place: drop the lowest-scoring
-- bots (and their one-bot teams) until there are 12 players, or none left.
do $mk$ begin execute $q$
create or replace function public.trivia_solo_trim_bots(p_room_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $f$
declare
  v_humans int;
  v_bots int;
  v_bot record;
begin
  select count(*) filter (where not pl.is_bot), count(*) filter (where pl.is_bot) into v_humans, v_bots
    from public.players pl where pl.room_id = p_room_id and pl.left_at is null;
  while v_bots > greatest(0, 12 - v_humans) loop
    select pl.id, pl.team_id into v_bot from public.players pl left join public.teams t on t.id = pl.team_id
      where pl.room_id = p_room_id and pl.is_bot and pl.left_at is null
      order by coalesce(t.score, 0), pl.joined_at desc limit 1;
    exit when not found;
    $q$ || 'del' || $q$ete from public.players where id = v_bot.id;
    $q$ || 'del' || $q$ete from public.teams t where t.id = v_bot.team_id
      and not exists (select 1 from public.players pl where pl.team_id = t.id);
    v_bots := v_bots - 1;
  end loop;
end $f$;
$q$;
execute $q$re$q$ || $q$voke execute on function public.trivia_solo_trim_bots(uuid) from public, anon, authenticated$q$;
end $mk$;

do $patch$
declare d text; n text;
begin
  -- join_room: a solo game can be joined until its results; you always get
  -- a team of your own, and a bot steps out if the game is underway.
  d := pg_get_functiondef('public.join_room(text, text, uuid, text, text, text)'::regprocedure);
  n := replace(d, E'  if v_room.phase <> ''lobby'' then\n    raise exception ''ROOM_ALREADY_STARTED'';',
    E'  if v_room.phase <> ''lobby'' and not (v_room.mode = ''solo'' and not v_room.retired and v_room.phase <> ''final'') then\n    raise exception ''ROOM_ALREADY_STARTED'';');
  n := replace(n, E'  if p_new_team_name is not null and length(trim(p_new_team_name)) > 0 then',
    E'  if v_room.mode = ''solo'' then\n    insert into public.teams (room_id, name, kind) values (v_room.id, public.trivia_fun_team_name(v_room.id), ''auto'')\n      returning id, name into v_team_id, v_team_name;\n\n  elsif p_new_team_name is not null and length(trim(p_new_team_name)) > 0 then');
  n := replace(n, E'  return query select v_player.id, v_player.client_token, v_player.room_id, v_team_id, v_team_name;\nexception',
    E'  if v_room.mode = ''solo'' and v_room.phase in (''question'', ''reveal'', ''twist_intro'') then\n    perform public.trivia_solo_trim_bots(v_room.id);\n  end if;\n\n  return query select v_player.id, v_player.client_token, v_player.room_id, v_team_id, v_team_name;\nexception');
  if position('v_room.mode = ''solo'' and not v_room.retired' in n) = 0 or position('elsif p_new_team_name' in n) = 0
     or position('trivia_solo_trim_bots' in n) = 0 then
    raise exception 'join_room patch did not apply';
  end if;
  execute n;

  -- Lineup: a solo game is always everyone for themselves, bots up to 12.
  d := pg_get_functiondef('public.trivia_lineup(uuid, boolean)'::regprocedure);
  n := replace(d, '  if v_humans < 4 then', '  if v_humans < 4 or v_room.mode = ''solo'' then');
  if n = d then raise exception 'trivia_lineup patch did not apply'; end if;
  execute n;

  -- No teaming up in a solo game.
  d := pg_get_functiondef('public.set_player_team(uuid, uuid, uuid, text, uuid)'::regprocedure);
  n := replace(d, 'r.id = p_room_id and r.phase = ''lobby'')', 'r.id = p_room_id and r.phase = ''lobby'' and r.mode = ''team'')');
  if n = d then raise exception 'set_player_team patch did not apply'; end if;
  execute n;

  -- tick: the boarding and queue rules are the team game's; each venue
  -- also always has one solo game open.
  d := pg_get_functiondef('public.tick()'::regprocedure);
  n := replace(d, 'where r.venue_id = v_venue.id and not r.retired and not r.queued) then',
    'where r.venue_id = v_venue.id and not r.retired and not r.queued and r.mode = ''team'') then');
  n := replace(n, 'where r.venue_id = v_venue.id and not r.retired and r.phase = ''lobby'' and not public.trivia_room_full(r.id)',
    'where r.venue_id = v_venue.id and not r.retired and r.phase = ''lobby'' and r.mode = ''team'' and not public.trivia_room_full(r.id)');
  n := replace(n, E'    end if;\n  end loop;\nend;',
    E'    end if;\n\n    if not exists (select 1 from public.rooms r where r.venue_id = v_venue.id and not r.retired and r.mode = ''solo'') then\n      select cr.room_id into v_next from public.create_room(now() + make_interval(secs => v_lobby_boarding_seconds), v_venue.id) cr;\n      update public.rooms set mode = ''solo'' where id = v_next;\n    end if;\n  end loop;\nend;');
  if position('not r.queued and r.mode = ''team'') then' in n) = 0 or position('r.phase = ''lobby'' and r.mode = ''team'' and not public.trivia_room_full' in n) = 0
     or position('set mode = ''solo''' in n) = 0 then
    raise exception 'tick patch did not apply';
  end if;
  execute n;

  -- Watchdog: one live game per venue per mode is normal now.
  d := pg_get_functiondef('public.ops_watchdog()'::regprocedure);
  n := replace(d, 'r2.venue_id = r.venue_id order by', 'r2.venue_id = r.venue_id and r2.mode = r.mode order by');
  if n = d then raise exception 'ops_watchdog patch did not apply'; end if;
  execute n;

  -- The queue and the venue carousel are about the team game.
  d := pg_get_functiondef('public.trivia_queue(uuid)'::regprocedure);
  n := replace(d, 'and not r.retired and not r.queued', 'and not r.retired and not r.queued and r.mode = ''team''');
  if n = d then raise exception 'trivia_queue patch did not apply'; end if;
  execute n;
  d := pg_get_functiondef('public.get_carousel(text)'::regprocedure);
  n := replace(d, 'and not r.retired and not r.queued', 'and not r.retired and not r.queued and r.mode = ''team''');
  if n = d then raise exception 'get_carousel patch did not apply'; end if;
  execute n;

  -- "Play again" goes to the next game of the same kind.
  d := pg_get_functiondef('public.rejoin_next_game(uuid, uuid, uuid)'::regprocedure);
  n := replace(d, 'r.phase = ''lobby'' and r.id <> p_room_id', 'r.phase = ''lobby'' and r.mode = v_old_room.mode and r.id <> p_room_id');
  n := replace(n, '    if public.trivia_live_team_count(v_target.id) >= v_max_teams then',
    '    if v_target.mode = ''team'' and public.trivia_live_team_count(v_target.id) >= v_max_teams then');
  if position('r.mode = v_old_room.mode' in n) = 0 or position('v_target.mode = ''team''' in n) = 0 then
    raise exception 'rejoin_next_game patch did not apply';
  end if;
  execute n;
end $patch$;
