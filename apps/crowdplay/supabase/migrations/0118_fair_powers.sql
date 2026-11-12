-- Fairer character powers. Every power still helps, but the strongest ones
-- wait until later in the game, and none can hand out an instant win.
--   Trivia:     Overclock is now +50% (was double). Void Rift: after question 3.
--   Bingo:      Rebuild, Riddle Sight, Void Rift: after 10 numbers. Rebuild and
--               Riddle Sight can't finish a line (you still have to win it).
--   Wild Match: Bloom, Second Wind, Overclock: after 8 cards are played.
--   Drop Line:  Trailblaze, Void Rift: after 8 pieces. Overclock: after 12.
-- (Perks are no longer offered in any game; their functions stay but the
-- games don't use them.)

alter table public.wm_rooms add column if not exists plays int not null default 0;

do $x$
declare f text; g text;
begin
  -- Wild Match: count cards played, show it, and gate the strong powers.
  select pg_get_functiondef('public.wm_apply_play'::regproc) into f;
  if position(E'\nbegin\n' in f) = 0 then raise exception 'wm_apply_play anchor'; end if;
  execute regexp_replace(f, E'\nbegin\n', E'\nbegin\n  update public.wm_rooms set plays = plays + 1 where id = p_room;\n');

  select pg_get_functiondef('public.wm_state'::regproc) into f;
  if position('''deck_left'', coalesce(array_length(r.deck, 1), 0),' in f) = 0 then raise exception 'wm_state anchor'; end if;
  execute replace(f, '''deck_left'', coalesce(array_length(r.deck, 1), 0),', '''deck_left'', coalesce(array_length(r.deck, 1), 0), ''plays'', r.plays,');

  select pg_get_functiondef('public.wm_use_char_power'::regproc) into f;
  g := 'if p.char_power_used_at is not null then raise exception ''POWER_USED''; end if;';
  if position(g in f) = 0 then raise exception 'wm_use_char_power anchor'; end if;
  execute replace(f, g, g || E'\n  if v_power in (''bloom'', ''secondwind'', ''overclock'') and r.plays < 8 then raise exception ''NOT_YET''; end if;');

  -- Drop Line: count pieces on the board.
  select pg_get_functiondef('public.dl_use_char_power'::regproc) into f;
  if position(g in f) = 0 then raise exception 'dl_use_char_power anchor'; end if;
  execute replace(f, g, g || E'\n  if v_power in (''trailblaze'', ''rift'') and (select count(*) from unnest(r.board) b where b in (1, 2)) < 8 then raise exception ''NOT_YET''; end if;'
    || E'\n  if v_power = ''overclock'' and (select count(*) from unnest(r.board) b where b in (1, 2)) < 12 then raise exception ''NOT_YET''; end if;');

  -- Bingo: wait for 10 numbers; free marks can't finish a line.
  select pg_get_functiondef('public.sb_use_char_power'::regproc) into f;
  g := 'n := coalesce(array_length(r.calls, 1), 0);';
  if position(g in f) = 0 then raise exception 'sb anchor 1'; end if;
  f := replace(f, g, g || E'\n  if v_power in (''rebuild'', ''riddle'', ''rift'') and n < 10 then raise exception ''NOT_YET''; end if;');
  g := E'    t.marks[p_index] := true;\n    update public.sb_teams set card = t.card, marks = t.marks where id = t.id;';
  if position(g in f) = 0 then raise exception 'sb anchor 2'; end if;
  f := replace(f, g, E'    t.marks[p_index] := true;\n    if public.sb_has_line(t.marks) then raise exception ''CANT_WIN_WITH_IT''; end if;\n    update public.sb_teams set card = t.card, marks = t.marks where id = t.id;');
  g := E'    t.marks[p_index] := true;\n    update public.sb_teams set marks = t.marks where id = t.id;\n  end if;';
  if position(g in f) = 0 then raise exception 'sb anchor 3'; end if;
  f := replace(f, g, E'    t.marks[p_index] := true;\n    if public.sb_has_line(t.marks) then raise exception ''CANT_WIN_WITH_IT''; end if;\n    update public.sb_teams set marks = t.marks where id = t.id;\n  end if;');
  execute f;

  -- Trivia: Void Rift after question 3; Overclock +50%.
  select pg_get_functiondef('public.use_power'::regproc) into f;
  g := E'    raise exception ''POWER_USED'';\n  end if;\n';
  if position(g in f) = 0 then raise exception 'use_power anchor'; end if;
  execute regexp_replace(f, E'    raise exception ''POWER_USED'';\n  end if;\n',
    E'    raise exception ''POWER_USED'';\n  end if;\n  if v_power = ''rift'' and v_rq.order_index < 3 then\n    raise exception ''NOT_YET'';\n  end if;\n');

  select pg_get_functiondef('public.trivia_team_points'::regproc) into f;
  g := 'case when (select power from pw) = ''overclock'' then 1 else 0 end';
  if position(g in f) = 0 then raise exception 'trivia_team_points anchor'; end if;
  execute replace(f, g, 'case when (select power from pw) = ''overclock'' then 0.5 else 0 end');
end $x$;
