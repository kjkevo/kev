-- Health check for the game clocks, for an outside monitor (via /api/health).
-- Problems:
--   * a game clock (cron job) is switched off or hasn't run successfully in
--     the last 20 seconds (they run every second);
--   * the watchdog (every 10 seconds) hasn't run in the last 60 seconds;
--   * a Drop Line or Wild Match turn is 45+ seconds overdue, a Bingo game
--     hasn't called a number for a minute, or a lobby is a minute past its
--     start time (the clock should have moved them on).
-- The watchdog now also watches the Bingo, Wild Match and Drop Line clocks,
-- nudges a frozen table by running its clock once by hand, and lists any
-- problem on the dashboard.

create or replace function public.game_health() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $function$
declare
  problems jsonb := '[]';
  j record;
  v_max bigint;
  v_n int;
begin
  select max(runid) into v_max from cron.job_run_details;
  for j in
    select c.jobname, c.active,
      (select max(d.end_time) from cron.job_run_details d
        where d.jobid = c.jobid and d.runid > coalesce(v_max, 0) - 3000 and d.status = 'succeeded') last_ok
    from cron.job c
    where c.jobname in ('trivia_autonomous_tick', 'trivia_bot_autopilot', 'family_feud_autonomous_tick',
                        'social_bingo_autonomous_tick', 'sb-tick', 'wm-tick', 'dl-tick')
  loop
    if not j.active then
      problems := problems || to_jsonb('Game clock ' || j.jobname || ' is switched off');
    elsif j.last_ok is null or j.last_ok < now() - interval '20 seconds' then
      problems := problems || to_jsonb('Game clock ' || j.jobname || ' has not run since '
        || coalesce(to_char(j.last_ok at time zone 'UTC', 'HH24:MI:SS') || ' UTC', 'a while'));
    end if;
  end loop;

  if not exists (select 1 from public.ops_heartbeat where name = 'watchdog' and last_run_at > now() - interval '60 seconds') then
    problems := problems || to_jsonb('The watchdog has not run in over a minute'::text);
  end if;

  select count(*) into v_n from public.dl_rooms
    where phase = 'playing' and turn_started_at < now() - make_interval(secs => turn_limit + 45);
  if v_n > 0 then problems := problems || to_jsonb(v_n || ' Drop Line game(s) stuck on a turn'); end if;
  select count(*) into v_n from public.wm_rooms
    where phase = 'playing' and turn_started_at < now() - interval '70 seconds';
  if v_n > 0 then problems := problems || to_jsonb(v_n || ' Wild Match game(s) stuck on a turn'); end if;
  select count(*) into v_n from public.sb_rooms
    where phase = 'playing' and last_call_at < now() - interval '66 seconds';
  if v_n > 0 then problems := problems || to_jsonb(v_n || ' Bingo game(s) stopped calling numbers'); end if;
  select (select count(*) from public.dl_rooms where phase = 'lobby' and starts_at < now() - interval '60 seconds')
       + (select count(*) from public.wm_rooms where phase = 'lobby' and starts_at < now() - interval '60 seconds')
       + (select count(*) from public.sb_rooms where phase = 'lobby' and starts_at < now() - interval '60 seconds') into v_n;
  if v_n > 0 then problems := problems || to_jsonb(v_n || ' game lobby(s) past their start time'); end if;

  return jsonb_build_object('ok', jsonb_array_length(problems) = 0, 'problems', problems, 'checked_at', now());
end;
$function$;

-- The watchdog: list health problems on the dashboard and nudge stuck tables.
create or replace function public.ops_watch_tables() returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  h jsonb := public.game_health();
  p text;
  v_err text;
begin
  if (select count(*) from public.dl_rooms where phase = 'playing' and turn_started_at < now() - make_interval(secs => turn_limit + 15)) > 0 then
    begin perform public.dl_tick(); exception when others then get stacked diagnostics v_err = message_text; end;
  end if;
  if (select count(*) from public.wm_rooms where phase = 'playing' and turn_started_at < now() - interval '40 seconds') > 0 then
    begin perform public.wm_tick(); exception when others then get stacked diagnostics v_err = message_text; end;
  end if;
  if (select count(*) from public.sb_rooms where phase = 'playing' and last_call_at < now() - interval '30 seconds') > 0 then
    begin perform public.sb_tick(); exception when others then get stacked diagnostics v_err = message_text; end;
  end if;
  for p in select jsonb_array_elements_text(h->'problems') loop
    perform public.ops_raise('health_' || left(md5(p), 8), 'needs_you', null, null, p,
      coalesce('A clock run by hand failed: ' || v_err, 'Found by the health check that the outside monitor uses.'));
  end loop;
end;
$function$;

do $x$
declare f text; g text;
begin
  select pg_get_functiondef('public.ops_watchdog'::regproc) into f;
  g := E'  insert into public.ops_heartbeat (name, last_run_at) values (''watchdog'', now())';
  if position(g in f) = 0 then raise exception 'ops_watchdog anchor'; end if;
  execute replace(f, g, E'  perform public.ops_watch_tables();\n\n' || g);
end $x$;
