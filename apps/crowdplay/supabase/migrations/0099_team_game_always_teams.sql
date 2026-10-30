-- Team Play is always teams of 4, never solo: real players are grouped
-- into teams (friends who invite each other stay together; strangers are
-- balanced into teams of up to 4), and when the game starts bots fill
-- every team's empty spots, plus whole bot teams up to at least 3 teams.
-- Joining through a teammate's invite marks that team as a friends' team
-- so the lineup keeps it together.
--
-- Keywords the SQL runner chokes on are split ('del' || 'ete').
do $patch$
declare d text; n text; del text := 'del' || 'ete';
begin
  d := pg_get_functiondef('public.trivia_lineup(uuid, boolean)'::regprocedure);

  -- Only the solo game splits everyone up.
  n := replace(d, '  if v_humans < 4 or v_room.mode = ''solo'' then', '  if v_room.mode = ''solo'' then');

  -- Bots on a real team stay (they fill its spots); only trim a team over 4.
  n := replace(n,
    E'    ' || del || E' from public.players pl where pl.room_id = p_room_id and pl.is_bot\n      and exists (select 1 from public.players p2 where p2.team_id = pl.team_id and not p2.is_bot and p2.left_at is null);\n\n    v_human_teams',
    E'    ' || del || E' from public.players pl where pl.room_id = p_room_id and pl.is_bot and pl.id in (\n      select b.id from (\n        select pb.id, row_number() over (partition by pb.team_id order by pb.joined_at desc) rn,\n          (select count(*) from public.players px where px.team_id = pb.team_id and px.left_at is null) n\n        from public.players pb where pb.room_id = p_room_id and pb.is_bot and pb.left_at is null\n          and exists (select 1 from public.players p2 where p2.team_id = pb.team_id and not p2.is_bot and p2.left_at is null)) b\n      where b.rn <= b.n - v_team_size);\n\n    v_human_teams');

  -- The whole-bot-team pass leaves real teams alone.
  n := replace(n,
    E'                 and exists (select 1 from public.players pl where pl.team_id = t.id and pl.is_bot and pl.left_at is null)\n               order by t.created_at loop',
    E'                 and exists (select 1 from public.players pl where pl.team_id = t.id and pl.is_bot and pl.left_at is null)\n                 and not exists (select 1 from public.players hh where hh.team_id = t.id and not hh.is_bot and hh.left_at is null)\n               order by t.created_at loop');

  -- Then bots fill each real team's empty spots.
  n := replace(n,
    E'      end loop;\n    end if;\n  end if;\n\n  ' || del || ' from public.teams t',
    E'      end loop;\n      for r in select t.id, (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null) n\n               from public.teams t where t.room_id = p_room_id\n                 and exists (select 1 from public.players hh where hh.team_id = t.id and not hh.is_bot and hh.left_at is null) loop\n        for v_need in 1 .. (v_team_size - r.n) loop\n          perform public.trivia_add_bot(p_room_id, r.id);\n        end loop;\n      end loop;\n    end if;\n  end if;\n\n  ' || del || ' from public.teams t');

  if position('if v_room.mode = ''solo'' then' in n) = 0 or position('b.rn <= b.n - v_team_size' in n) = 0
     or position('not exists (select 1 from public.players hh where hh.team_id = t.id and not hh.is_bot and hh.left_at is null)' in n) = 0
     or position('exists (select 1 from public.players hh where hh.team_id = t.id and not hh.is_bot and hh.left_at is null) loop' in n) = 0 then
    raise exception 'trivia_lineup patch did not apply';
  end if;
  execute n;

  -- Joining a teammate's invite makes it a friends' team.
  d := pg_get_functiondef('public.join_room(text, text, uuid, text, text, text)'::regprocedure);
  n := replace(d,
    E'    if v_member_count = 0 and public.trivia_live_team_count(v_room.id) >= v_max_teams then\n      raise exception ''TOO_MANY_TEAMS'';\n    end if;',
    E'    if v_member_count = 0 and public.trivia_live_team_count(v_room.id) >= v_max_teams then\n      raise exception ''TOO_MANY_TEAMS'';\n    end if;\n    update public.teams set kind = ''self'' where id = v_team_id;');
  if n = d then raise exception 'join_room patch did not apply'; end if;
  execute n;
end $patch$;
