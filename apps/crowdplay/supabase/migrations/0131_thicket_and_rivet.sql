-- Two new characters, each with its own power in all 4 games.
--   Thicket (bramble) - Tangle: slows rivals down.
--     Trivia:     the leading team's points this question are cut in half (ready after question 3)
--     Bingo:      every rival can't mark for 8 seconds
--     Wild Match: everyone else draws 1
--     Drop Line:  blocks their best column for their next turn
--   Rivet (metal builder) - Lock On: sets up your own win.
--     Trivia:     right = double points, wrong = lose 200
--     Bingo:      the next number called is on your card (ready after 10 numbers)
--     Wild Match: changes the color to the one you have most of
--     Drop Line:  turns their top piece in a column into a block (ready after 8 pieces)
-- $9.99 each, or free at level 40 (Thicket) and 45 (Rivet).

insert into public.avatars (id, name, emoji, image_url, price_cents, active, sort, unlock_level) values
  ('thicket', 'Thicket', null, '/avatars/thicket-256.png', 999, true, 19, 40),
  ('rivet', 'Rivet', null, '/avatars/rivet-256.png', 999, true, 20, 45)
on conflict (id) do update set name = excluded.name, image_url = excluded.image_url, price_cents = excluded.price_cents,
  active = true, sort = excluded.sort, unlock_level = excluded.unlock_level;

-- Which power each character has, per game.
do $x$
declare fn text; f text; g text;
begin
  foreach fn in array array['dl_char_power', 'wm_char_power', 'sb_char_power'] loop
    select pg_get_functiondef(('public.' || fn || '(text)')::regprocedure) into f;
    g := ' end;';
    if position(g in f) = 0 then raise exception '% anchor', fn; end if;
    execute replace(f, g, E'\n    when ''thicket'' then ''tangle'' when ''rivet'' then ''lockon'' end;');
  end loop;
  select pg_get_functiondef('public.trivia_power_for(text)'::regprocedure) into f;
  g := E'    when ''stone-golem'' then ''second_wind''\n';
  if position(g in f) = 0 then raise exception 'trivia_power_for anchor'; end if;
  execute replace(f, g, g || E'    when ''thicket'' then ''tangle''\n    when ''rivet'' then ''lockon''\n');
end $x$;

-- Drop Line.
do $x$
declare f text; g text;
begin
  select pg_get_functiondef('public.dl_use_char_power(uuid,uuid,uuid,integer)'::regprocedure) into f;
  g := E'  if v_power in (''trailblaze'', ''rift'') and';
  if position(g in f) = 0 then raise exception 'dl anchor 1'; end if;
  f := replace(f, g, E'  if v_power in (''trailblaze'', ''rift'', ''lockon'') and');
  g := E'    when ''overclock'' then ''Overclock'' when ''secondwind'' then ''Second Wind'' end;';
  if position(g in f) = 0 then raise exception 'dl anchor 2'; end if;
  f := replace(f, g, E'    when ''overclock'' then ''Overclock'' when ''secondwind'' then ''Second Wind''\n    when ''tangle'' then ''Tangle'' when ''lockon'' then ''Lock On'' end;');
  g := E'  if v_power in (''trailblaze'', ''shield'', ''bloom'') and (p_col is null';
  if position(g in f) = 0 then raise exception 'dl anchor 3'; end if;
  f := replace(f, g, E'  if v_power in (''trailblaze'', ''shield'', ''bloom'', ''lockon'') and (p_col is null');
  g := E'  elsif v_power = ''secondwind'' then';
  if position(g in f) = 0 then raise exception 'dl anchor 4'; end if;
  f := replace(f, g, E'  elsif v_power = ''tangle'' then\n'
    || E'    v_c := public.dl_best_col(r.board, v_them);\n'
    || E'    if v_c is null or public.dl_landing(r.board, v_c) is null then\n'
    || E'      select x into v_c from generate_series(0, 6) x where public.dl_landing(r.board, x) is not null order by random() limit 1;\n'
    || E'    end if;\n'
    || E'    if v_c is null then raise exception ''COLUMN_FULL''; end if;\n'
    || E'    update public.dl_rooms set blocked_col = v_c, blocked_color = v_them where id = p_room_id;\n'
    || E'    v_data := jsonb_build_object(''col'', v_c);\n'
    || E'  elsif v_power = ''lockon'' then\n'
    || E'    select max(x) into v_row from generate_series(0, 5) x where r.board[x * 7 + p_col + 1] <> 0;\n'
    || E'    if v_row is null or r.board[v_row * 7 + p_col + 1] <> v_them then raise exception ''NOTHING_TO_TAKE''; end if;\n'
    || E'    if v_prot @> to_jsonb(p_col) then raise exception ''PROTECTED''; end if;\n'
    || E'    r.board[v_row * 7 + p_col + 1] := 3;\n'
    || E'    update public.dl_rooms set board = r.board where id = p_room_id;\n'
    || g);
  execute f;
end $x$;

-- Wild Match.
do $x$
declare f text; g text;
begin
  select pg_get_functiondef('public.wm_use_char_power(uuid,uuid,uuid,integer)'::regprocedure) into f;
  g := E'    when ''overclock'' then ''Overclock'' when ''secondwind'' then ''Second Wind'' end;';
  if position(g in f) = 0 then raise exception 'wm anchor 1'; end if;
  f := replace(f, g, E'    when ''overclock'' then ''Overclock'' when ''secondwind'' then ''Second Wind''\n    when ''tangle'' then ''Tangle'' when ''lockon'' then ''Lock On'' end;');
  g := E'  elsif v_power = ''secondwind'' then';
  if position(g in f) = 0 then raise exception 'wm anchor 2'; end if;
  f := replace(f, g, E'  elsif v_power = ''tangle'' then\n'
    || E'    for o in select * from public.wm_players where room_id = p_room_id and id <> p.id and team <> p.team and left_at is null loop\n'
    || E'      perform public.wm_draw_cards(p_room_id, o.seat, 1);\n'
    || E'    end loop;\n'
    || E'  elsif v_power = ''lockon'' then\n'
    || E'    select (array[''red'', ''blue'', ''green'', ''yellow''])[c / 25 + 1] into v_name from unnest(p.hand) c where c < 100\n'
    || E'      group by c / 25 order by count(*) desc, random() limit 1;\n'
    || E'    if v_name is null then raise exception ''NO_COLOR''; end if;\n'
    || E'    update public.wm_rooms set current_color = v_name where id = p_room_id;\n'
    || E'    v_data := jsonb_build_object(''color'', v_name);\n'
    || E'    v_name := ''Lock On'';\n'
    || g);
  execute f;
end $x$;

-- Bingo.
do $x$
declare f text; g text;
begin
  select pg_get_functiondef('public.sb_use_char_power(uuid,uuid,uuid,integer)'::regprocedure) into f;
  g := E'  if v_power in (''rebuild'', ''riddle'', ''rift'') and n < 10';
  if position(g in f) = 0 then raise exception 'sb anchor 1'; end if;
  f := replace(f, g, E'  if v_power in (''rebuild'', ''riddle'', ''rift'', ''lockon'') and n < 10');
  g := E'  elsif v_power = ''riddle'' then';
  if position(g in f) = 0 then raise exception 'sb anchor 2'; end if;
  f := replace(f, g, E'  elsif v_power = ''tangle'' then\n'
    || E'    update public.sb_teams set frozen_until = greatest(coalesce(frozen_until, now()), now() + interval ''8 seconds''),\n'
    || E'      bot_bingo_at = case when bot_bingo_at is not null then greatest(bot_bingo_at, now() + interval ''8 seconds'') end\n'
    || E'      where room_id = p_room_id and id <> t.id;\n'
    || E'    if not found then raise exception ''NO_RIVAL''; end if;\n'
    || E'  elsif v_power = ''lockon'' then\n'
    || E'    -- Pull one of your numbers to the front of the deck (never one that finishes a line).\n'
    || E'    select i2 into i from generate_series(1, 25) i2\n'
    || E'      where i2 <> 13 and not t.marks[i2] and not (t.card[i2] = any(r.calls))\n'
    || E'        and not public.sb_has_line((select array_agg(case when k = i2 then true else t.marks[k] end order by k) from generate_series(1, 25) k))\n'
    || E'        and array_position(r.deck[n + 1:], t.card[i2]) is not null\n'
    || E'      order by random() limit 1;\n'
    || E'    if i is null then raise exception ''NOTHING_TO_PULL''; end if;\n'
    || E'    v_num := t.card[i];\n'
    || E'    update public.sb_rooms set deck = r.deck[1:n] || v_num || array_remove(r.deck[n + 1:], v_num) where id = p_room_id;\n'
    || E'    v_data := jsonb_build_object(''number'', v_num);\n'
    || g);
  execute f;
end $x$;

-- Trivia.
do $x$
declare f text; g text;
begin
  select pg_get_functiondef('public.use_power(uuid,uuid,uuid,uuid)'::regprocedure) into f;
  g := E'  if v_power = ''rift'' and v_rq.order_index < 3 then';
  if position(g in f) = 0 then raise exception 'use_power anchor 1'; end if;
  f := replace(f, g, E'  if v_power in (''rift'', ''tangle'') and v_rq.order_index < 3 then');
  g := E'  elsif v_power <> ''rift'' and v_locked.team_id is not null then';
  if position(g in f) = 0 then raise exception 'use_power anchor 2'; end if;
  f := replace(f, g, E'  elsif v_power not in (''rift'', ''tangle'') and v_locked.team_id is not null then');
  g := E'  elsif v_power = ''second_wind'' then\n    if v_locked.correct then';
  if position(g in f) = 0 then raise exception 'use_power anchor 3'; end if;
  f := replace(f, g, E'  elsif v_power = ''tangle'' then\n'
    || E'    select t.id into v_target from public.teams t\n'
    || E'      where t.room_id = p_room_id and t.id <> v_team\n'
    || E'        and exists (select 1 from public.players pl where pl.team_id = t.id and pl.left_at is null)\n'
    || E'      order by public.trivia_team_score(t.id) desc, t.created_at limit 1;\n'
    || E'    if v_target is null then raise exception ''NO_RIVAL''; end if;\n'
    || E'    v_data := jsonb_build_object(''target_name'', (select name from public.teams where id = v_target));\n\n'
    || g);
  execute f;

  select pg_get_functiondef('public.trivia_team_points(uuid,uuid)'::regprocedure) into f;
  g := E'         + case when (select power from pw) = ''overclock'' then 0.5 else 0 end)';
  if position(g in f) = 0 then raise exception 'team_points anchor 1'; end if;
  f := replace(f, g, E'         + case when (select power from pw) = ''overclock'' then 0.5 else 0 end\n'
    || E'         + case when (select power from pw) = ''lockon'' then 1 else 0 end)\n'
    || E'      * case when exists (select 1 from public.trivia_powers x where x.target_team_id = p_team_id\n'
    || E'               and x.question_id = p_question_id and x.power = ''tangle'') then 0.5 else 1 end');
  execute f;

  select pg_get_functiondef('public.trivia_team_award(uuid,uuid,boolean)'::regprocedure) into f;
  g := E'    else 0 end;';
  if position(g in f) = 0 then raise exception 'team_award anchor'; end if;
  execute replace(f, g, E'    when exists (select 1 from public.trivia_powers p\n'
    || E'                 where p.team_id = p_team_id and p.question_id = p_question_id and p.power = ''lockon'') then -200\n'
    || g);
end $x$;
