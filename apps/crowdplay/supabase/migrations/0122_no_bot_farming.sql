-- Stop XP farming against bots.
--   * A game with no other real person gives 10 XP and no win bonus (and the
--     win doesn't count toward your wins or "Players of the week").
--   * At most 800 XP a day per player (about 5 great games), in every game.
--   * "Players of the week" only counts games played with real people.
-- (Ranks already only count games with real people: migration 0120.)

alter table public.profile_games add column if not exists vs_people boolean not null default true;

-- The XP a game gives after the daily cap.
create or replace function public.progress_game_xp(p_profile uuid, p_xp int, p_day date) returns int
language sql stable security definer set search_path to 'public' as $$
  select least(greatest(p_xp, 0), greatest(0, 800 - coalesce((
    select sum(g.xp) from public.profile_games g where g.profile_id = p_profile and g.played_on = p_day), 0)))::int
$$;

do $x$
declare
  f text; fn text; tbl text; g text;
begin
  foreach fn in array array['dl_record_progress', 'wm_record_progress', 'sb_record_progress', 'progress_record_room'] loop
    tbl := case fn when 'dl_record_progress' then 'dl_players' when 'wm_record_progress' then 'wm_players'
                   when 'sb_record_progress' then 'sb_players' else 'players' end;
    select pg_get_functiondef(('public.' || fn)::regproc) into f;

    g := E'  v_new int;\n';
    if position(g in f) = 0 then raise exception '% anchor declare', fn; end if;
    f := regexp_replace(f, E'  v_new int;\n', E'  v_new int;\n  v_people boolean;\n');

    g := E'    v_profile := public.progress_profile_for(rec.device_key);\n';
    if position(g in f) = 0 then raise exception '% anchor loop', fn; end if;
    f := replace(f, g, E'    v_people := (select count(distinct x.device_key) from public.' || tbl
      || E' x where x.room_id = p_room_id and not x.is_bot and x.device_key is not null) >= 2;\n' || g);

    if fn = 'progress_record_room' then
      g := E'    if rec.perk = ''xp_surge'' then v_xp := (v_xp * 3) / 2; end if;\n';
      if position(g in f) = 0 then raise exception '% anchor xp', fn; end if;
      f := replace(f, g, g || E'    v_xp := public.progress_game_xp(v_profile, case when v_people then v_xp else 10 end, v_day);\n');
      g := 'wins = p.wins + case when rec.place = 1 and v_teams >= 2 and rec.score > 0 then 1 else 0 end';
      if position(g in f) = 0 then raise exception '% anchor wins', fn; end if;
      f := replace(f, g, 'wins = p.wins + case when rec.place = 1 and v_teams >= 2 and rec.score > 0 and v_people then 1 else 0 end');
    else
      g := 'v_xp := 20 + case when v_won then 60 else 0 end;';
      if position(g in f) = 0 then raise exception '% anchor xp', fn; end if;
      f := replace(f, g, 'v_xp := public.progress_game_xp(v_profile, case when v_people then 20 + case when v_won then 60 else 0 end else 10 end, v_day);');
      g := 'wins = pr.wins + case when v_won then 1 else 0 end';
      if position(g in f) = 0 then raise exception '% anchor wins', fn; end if;
      f := replace(f, g, 'wins = pr.wins + case when v_won and v_people then 1 else 0 end');
    end if;

    g := E'    get diagnostics v_new = row_count;\n';
    if position(g in f) = 0 then raise exception '% anchor diag', fn; end if;
    f := replace(f, g, g || E'    if not v_people then\n      update public.profile_games set vs_people = false, won = false where profile_id = v_profile and room_id = p_room_id;\n    end if;\n');
    execute f;
  end loop;

  -- Players of the week: games with real people only.
  select pg_get_functiondef('public.get_leaderboard'::regproc) into f;
  g := E'    where g.played_at >= v_start\n';
  if position(g in f) = 0 then raise exception 'get_leaderboard anchor'; end if;
  execute replace(f, g, E'    where g.played_at >= v_start and g.vs_people\n');

  -- Wins rebuilt after joining phones only count games with real people.
  select pg_get_functiondef('public.progress_recompute'::regproc) into f;
  g := 'g.profile_id = p_profile and g.won)';
  if position(g in f) = 0 then raise exception 'progress_recompute anchor'; end if;
  execute replace(f, g, 'g.profile_id = p_profile and g.won and g.vs_people)');
end $x$;
