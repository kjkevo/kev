-- Ops watchdog: a database-side watcher that runs every 10 seconds, fixes
-- small, well-understood problems on its own, and flags anything bigger for
-- the owner. Everything it sees or does lands in public.ops_events, which the
-- ops dashboard renders and the hourly AI assistant reviews, so the owner,
-- the dashboard and the assistant are always looking at the same log.
--
-- Severity:
--   fixed     -- handled automatically (open = still being worked on)
--   heads_up  -- worth knowing, nothing broken right now
--   needs_you -- the owner has to decide or act; the assistant notifies
--
-- Condition-style events (a ticker failing, a game stuck) stay open while the
-- condition holds and resolve themselves the first run it no longer does.
-- One-off fixes are logged already resolved.
--
-- Nothing here is readable by anon/authenticated: the dashboard reads through
-- the owner's own Supabase connector.

create table public.ops_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  source text not null default 'watchdog' check (source in ('watchdog', 'assistant')),
  severity text not null check (severity in ('fixed', 'heads_up', 'needs_you')),
  kind text not null,
  game text,
  room_code text,
  title text not null,
  detail text,
  action_taken text,
  occurrences int not null default 1,
  notified_at timestamptz
);
create unique index ops_events_one_open_per_condition
  on public.ops_events (kind, coalesce(room_code, '')) where resolved_at is null;
create index ops_events_recent on public.ops_events (last_seen_at desc);
alter table public.ops_events enable row level security; -- no policies: owner-only

create table public.ops_heartbeat (
  name text primary key,
  last_run_at timestamptz not null default now(),
  note text
);
alter table public.ops_heartbeat enable row level security; -- no policies: owner-only

-- Open (or refresh) a condition. Severity can escalate on refresh, never drop.
create or replace function public.ops_raise(
  p_kind text, p_severity text, p_game text, p_room_code text,
  p_title text, p_detail text default null, p_action text default null,
  p_source text default 'watchdog'
)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into public.ops_events (source, severity, kind, game, room_code, title, detail, action_taken)
    values (p_source, p_severity, p_kind, p_game, p_room_code, p_title, p_detail, p_action)
  on conflict (kind, coalesce(room_code, '')) where resolved_at is null do update set
    last_seen_at = now(),
    occurrences = ops_events.occurrences + 1,
    severity = case
      when excluded.severity = 'needs_you' or ops_events.severity = 'needs_you' then 'needs_you'
      when excluded.severity = 'heads_up' or ops_events.severity = 'heads_up' then 'heads_up'
      else 'fixed' end,
    title = excluded.title,
    detail = excluded.detail,
    action_taken = coalesce(excluded.action_taken, ops_events.action_taken);
end;
$function$;

-- Log a one-off fix, already resolved.
create or replace function public.ops_fixed(
  p_kind text, p_game text, p_room_code text, p_title text, p_action text,
  p_detail text default null, p_source text default 'watchdog'
)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into public.ops_events (source, severity, kind, game, room_code, title, detail, action_taken, resolved_at)
    values (p_source, 'fixed', p_kind, p_game, p_room_code, p_title, p_detail, p_action, now());
end;
$function$;

create or replace function public.ops_watchdog()
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v_run_started timestamptz := now(); -- same clock ops_raise stamps last_seen_at with
  v_room record;
  v_job record;
  v_overdue numeric;
  v_n int;
  v_err text;
begin
  -- 1. Zombie rooms: retired but never reached 'final' (restart_trivia_now
  --    retires without finishing), so the tickers keep driving them.
  for v_room in select id, code from public.rooms where retired and phase <> 'final' loop
    update public.rooms set phase = 'final', phase_started_at = now() where id = v_room.id;
    perform public.ops_fixed('zombie_room', 'trivia', v_room.code,
      'Closed a leftover trivia room that was still running in the background',
      'Marked it finished so it stops using the game clock.');
  end loop;
  for v_room in select id, code from public.feud_rooms where retired and phase <> 'final' loop
    update public.feud_rooms set phase = 'final', phase_started_at = now() where id = v_room.id;
    perform public.ops_fixed('zombie_room', 'feud', v_room.code,
      'Closed a leftover Family Feud room that was still running in the background',
      'Marked it finished so it stops using the game clock.');
  end loop;
  for v_room in select id, code from public.bingo_rooms where retired and phase <> 'final' loop
    update public.bingo_rooms set phase = 'final', phase_started_at = now() where id = v_room.id;
    perform public.ops_fixed('zombie_room', 'bingo', v_room.code,
      'Closed a leftover Bingo room that was still running in the background',
      'Marked it finished so it stops using the game clock.');
  end loop;

  -- 2. More than one live trivia room: the venue screen and /trivia only
  --    follow the newest, so anyone in an older one is stranded.
  for v_room in
    select r.id, r.code,
      (select count(*) from public.players p where p.room_id = r.id and p.left_at is null and p.nickname not like 'BOT %') humans
    from public.rooms r
    where not r.retired and r.id <> (select id from public.rooms where not retired order by created_at desc limit 1)
  loop
    if v_room.humans = 0 then
      update public.rooms set retired = true, phase = 'final', phase_started_at = now() where id = v_room.id;
      perform public.ops_fixed('duplicate_room', 'trivia', v_room.code,
        'Closed an extra trivia room nobody was playing in',
        'Retired it so only one game is live.');
    else
      perform public.ops_raise('duplicate_room', 'needs_you', 'trivia', v_room.code,
        'Two trivia games are live at once, and people are in the older one',
        v_room.humans || ' player(s) are in an older room the venue screen no longer shows.',
        'Left it alone so nobody gets kicked mid-game.');
    end if;
  end loop;

  -- 3. A lobby with no start time never starts on its own.
  for v_room in select id, code from public.rooms where not retired and phase = 'lobby' and starts_at is null loop
    update public.rooms set starts_at = now() + interval '120 seconds' where id = v_room.id;
    perform public.ops_fixed('lobby_no_start', 'trivia', v_room.code,
      'A trivia lobby had no start time',
      'Scheduled it to start in 2 minutes.');
  end loop;

  -- 4. Stuck trivia game: the clock ran out but the phase never moved.
  --    Nudge it once by running the game clock by hand; if it's still stuck
  --    a minute past, it's a real fault.
  for v_room in
    select r.id, r.code, r.phase, r.starts_at, r.question_started_at, r.current_question_index,
      (select q.time_limit_seconds from public.room_questions rq join public.questions q on q.id = rq.question_id
        where rq.room_id = r.id and rq.order_index = r.current_question_index) time_limit,
      exists (select 1 from public.room_questions rq where rq.room_id = r.id and rq.order_index = r.current_question_index) has_question
    from public.rooms r where not r.retired and r.phase in ('lobby', 'question')
  loop
    if v_room.phase = 'question' and not v_room.has_question then
      perform public.ops_raise('missing_question', 'needs_you', 'trivia', v_room.code,
        'A trivia game has no question to show',
        'Question ' || (v_room.current_question_index + 1) || ' is missing from this game''s question list, so phones show a blank screen.');
      continue;
    end if;

    v_overdue := extract(epoch from now() - case
      when v_room.phase = 'lobby' then v_room.starts_at
      else v_room.question_started_at + make_interval(secs => v_room.time_limit) end);

    if v_overdue > 60 then
      perform public.ops_raise('stuck_game', 'needs_you', 'trivia', v_room.code,
        'A trivia game is frozen',
        'Its ' || v_room.phase || ' timer ran out ' || round(v_overdue) || 's ago and the game clock hasn''t moved it on.',
        'Tried restarting the game clock; it didn''t help.');
    elsif v_overdue > 15 then
      begin
        perform public.tick();
        perform public.ops_raise('stuck_game', 'fixed', 'trivia', v_room.code,
          'A trivia game was a few seconds behind',
          'Its ' || v_room.phase || ' timer ran out ' || round(v_overdue) || 's ago.',
          'Ran the game clock by hand to move it along.');
      exception when others then
        get stacked diagnostics v_err = message_text;
        perform public.ops_raise('stuck_game', 'needs_you', 'trivia', v_room.code,
          'A trivia game is frozen and the game clock is erroring',
          'The game clock failed with: ' || v_err);
      end;
    end if;
  end loop;

  -- 5. No live trivia room at all: the game clock should always have one.
  if not exists (select 1 from public.rooms where not retired) then
    perform public.create_room(now() + interval '120 seconds');
    perform public.ops_fixed('no_live_room', 'trivia', null,
      'There was no trivia game open to join',
      'Opened a new lobby starting in 2 minutes.');
  end if;

  -- 6. Game clocks (pg_cron jobs): paused, erroring, or silent.
  for v_job in
    select j.jobname, j.active,
      case j.jobname
        when 'trivia_autonomous_tick' then 'trivia'
        when 'family_feud_autonomous_tick' then 'feud'
        when 'social_bingo_autonomous_tick' then 'bingo'
      end game,
      (select count(*) from cron.job_run_details d where d.jobid = j.jobid and d.status = 'failed'
        and d.start_time > now() - interval '2 minutes') fails,
      (select d.return_message from cron.job_run_details d where d.jobid = j.jobid and d.status = 'failed'
        order by d.start_time desc limit 1) last_error,
      (select max(d.end_time) from cron.job_run_details d where d.jobid = j.jobid and d.status = 'succeeded'
        and d.start_time > now() - interval '5 minutes') last_ok
    from cron.job j
    where j.jobname in ('trivia_autonomous_tick', 'family_feud_autonomous_tick', 'social_bingo_autonomous_tick')
  loop
    if not v_job.active then
      perform public.ops_raise('clock_paused', 'needs_you', v_job.game, null,
        'The ' || v_job.game || ' game clock is switched off',
        'Games won''t advance on their own until it''s turned back on.');
    elsif v_job.fails > 0 then
      perform public.ops_raise('clock_failing_' || v_job.game, 'needs_you', v_job.game, null,
        'The ' || v_job.game || ' game clock is erroring',
        v_job.fails || ' failed run(s) in the last 2 minutes. Latest error: ' || coalesce(v_job.last_error, 'none recorded'));
    elsif v_job.last_ok is null or v_job.last_ok < now() - interval '30 seconds' then
      perform public.ops_raise('clock_silent_' || v_job.game, 'needs_you', v_job.game, null,
        'The ' || v_job.game || ' game clock has gone quiet',
        'No successful run since ' || coalesce(to_char(v_job.last_ok, 'HH24:MI:SS'), 'at least 5 minutes ago') || ' UTC.');
    end if;
  end loop;

  -- 7. Housekeeping: the game clocks log a row every second each (~35 MB a
  --    day). Keep one day; trim the backlog in small bites so no run is slow.
  select count(*) into v_n from (
    select 1 from cron.job_run_details where end_time < now() - interval '1 day' limit 50001
  ) s;
  if v_n > 0 then
    delete from cron.job_run_details where runid in (
      select runid from cron.job_run_details where end_time < now() - interval '1 day'
      order by runid limit 5000
    );
    if v_n > 50000 then
      perform public.ops_raise('run_log_trim', 'fixed', null, null,
        'Trimming the game clock''s run log',
        'It had grown past a day of history (every clock logs a row per second). Old rows are being removed a few thousand at a time.',
        'Keeping the last 24 hours; this clears itself once the backlog is gone.');
    end if;
  end if;

  -- 8. Test bots still switched on.
  if exists (select 1 from cron.job where jobname = 'trivia_bot_autopilot' and active) then
    perform public.ops_raise('test_bots_on', 'heads_up', 'trivia', null,
      'Test bots are joining every trivia game',
      'Nine bot players join each lobby and answer questions. Turn them off before real customers play.',
      'Left on because you''re testing.');
  end if;

  -- 9. Known content problem: answers the matcher can never accept.
  select count(*) into v_n from public.questions q
    where length(public.normalize_feud_text(q.choices->>q.correct_index)) < 2;
  if v_n > 0 then
    perform public.ops_raise('unanswerable_questions', 'heads_up', 'trivia', null,
      v_n || ' trivia questions can''t be answered correctly',
      'Their answers are a single digit or letter (like "3" or "9"), and the answer checker ignores anything shorter than 2 characters, so every team gets them wrong.',
      'Needs a scoring fix; not changed automatically.');
  end if;

  -- Resolve watchdog conditions that didn't come up this run.
  update public.ops_events set resolved_at = now()
    where resolved_at is null and source = 'watchdog' and last_seen_at < v_run_started;

  insert into public.ops_heartbeat (name, last_run_at) values ('watchdog', now())
    on conflict (name) do update set last_run_at = excluded.last_run_at;
end;
$function$;

-- The AI assistant records its hourly review here.
create or replace function public.ops_assistant_checkin(p_note text)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into public.ops_heartbeat (name, last_run_at, note) values ('assistant', now(), p_note)
    on conflict (name) do update set last_run_at = excluded.last_run_at, note = excluded.note;
end;
$function$;

revoke execute on function public.ops_raise(text, text, text, text, text, text, text, text) from anon, authenticated, public;
revoke execute on function public.ops_fixed(text, text, text, text, text, text, text) from anon, authenticated, public;
revoke execute on function public.ops_watchdog() from anon, authenticated, public;
revoke execute on function public.ops_assistant_checkin(text) from anon, authenticated, public;

select cron.schedule('ops_watchdog', '10 seconds', 'select public.ops_watchdog();');
