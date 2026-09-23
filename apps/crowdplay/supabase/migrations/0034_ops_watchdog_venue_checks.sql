-- Watcher checks for the venue layer (0033): TVs going dark, check-ins
-- failing to save, a busy night gone quiet, and founding sponsor trials
-- ending within 7 days. Otherwise identical to 0032.

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
  -- 1. Zombie rooms: retired but never reached 'final'. 0031 stopped both
  --    known causes; this stays as a backstop.
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

  -- 9. Answer self-test: every active question must accept its own answer
  --    and each of its listed alternatives. If an edit ever breaks that,
  --    every team would be marked wrong on it.
  select count(*) into v_n from public.questions q
    where q.active and (
      not public.trivia_answer_matches(q.choices->>q.correct_index, q.id)
      or exists (select 1 from unnest(q.accepted_answers) alt where not public.trivia_answer_matches(alt, q.id)));
  if v_n > 0 then
    perform public.ops_raise('unanswerable_questions', 'needs_you', 'trivia', null,
      v_n || ' trivia question(s) would reject their own correct answer',
      'The answer checker doesn''t accept the stored answer (or one of its listed alternatives) for these questions, so every team would be marked wrong on them.',
      'Nothing changed automatically; the question or its alternatives need editing.');
  end if;

  -- 10. A venue TV stopped checking in (it pings every 30 seconds). Loud in
  --     the evening, quiet otherwise so closing time doesn't page you.
  for v_room in
    select s.screen_key, s.page, s.last_seen_at, v.slug, v.name,
      extract(hour from now() at time zone v.timezone)::int local_hour
    from public.venue_screens s join public.venues v on v.id = s.venue_id
    where v.active and s.last_seen_at > now() - interval '12 hours' and s.last_seen_at < now() - interval '3 minutes'
  loop
    perform public.ops_raise('screen_offline',
      case when v_room.local_hour >= 17 or v_room.local_hour < 2 then 'needs_you' else 'heads_up' end,
      'venue', v_room.slug || ':' || left(v_room.screen_key, 6),
      'A TV at ' || v_room.name || ' went dark',
      'This screen (' || coalesce(v_room.page, 'game screen') || ') last checked in '
        || round(extract(epoch from now() - v_room.last_seen_at) / 60) || ' min ago. It''s probably switched off, frozen, or off the Wi-Fi.');
  end loop;

  -- 11. Check-ins failing to save. The page lets guests through anyway, so
  --     nobody at the venue notices; this is the only place it shows up.
  for v_room in
    select v.slug, v.name, count(e.id) n, (array_agg(e.message order by e.created_at desc))[1] latest
    from public.client_errors e join public.venues v on v.id = e.venue_id
    where e.source = 'checkin' and e.created_at > now() - interval '30 minutes'
      and e.created_at > coalesce((select max(c.created_at) from public.checkins c where c.venue_id = v.id), '-infinity')
    group by v.slug, v.name
  loop
    perform public.ops_raise('checkin_failing', 'needs_you', 'venue', v_room.slug,
      'Check-ins at ' || v_room.name || ' aren''t saving',
      v_room.n || ' failed save(s) since the last one that worked. Latest error: ' || v_room.latest
        || '. Guests are still let through, so they aren''t being counted.');
  end loop;

  -- 12. A busy night gone quiet: Friday or Saturday evening, a TV is on, the
  --     venue normally gets check-ins, and none for 2 hours.
  for v_room in
    select v.slug, v.name, (select max(c.created_at) from public.checkins c where c.venue_id = v.id) last_ci
    from public.venues v
    where v.active
      and extract(isodow from (public.venue_night_start(v.timezone) at time zone v.timezone)) in (5, 6)
      and extract(hour from now() at time zone v.timezone) not between 2 and 18
      and exists (select 1 from public.venue_screens s where s.venue_id = v.id and s.last_seen_at > now() - interval '3 minutes')
      and exists (select 1 from public.checkins c where c.venue_id = v.id and c.created_at > now() - interval '28 days')
  loop
    if v_room.last_ci is null or v_room.last_ci < now() - interval '2 hours' then
      perform public.ops_raise('checkin_quiet', 'needs_you', 'venue', v_room.slug,
        'No check-ins at ' || v_room.name || ' for 2+ hours on a busy night',
        'The TV is on, but nobody has checked in since ' || coalesce(to_char(v_room.last_ci at time zone 'UTC', 'HH24:MI') || ' UTC', 'before tonight')
          || '. Worth checking the QR code is visible and the check-in page loads.');
    end if;
  end loop;

  -- 13. Founding sponsor trials ending within 7 days (or already past and
  --     still running at the founding rate). Never let one roll over silently.
  for v_room in
    select s.id, s.name, s.trial_ends_on, v.name venue,
      s.trial_ends_on - (now() at time zone v.timezone)::date days_left
    from public.sponsors s join public.venues v on v.id = s.venue_id
    where s.status = 'active' and s.is_founding and s.trial_ends_on is not null
      and s.trial_ends_on <= (now() at time zone v.timezone)::date + 7
  loop
    perform public.ops_raise('sponsor_trial_ending', 'needs_you', 'sponsor', v_room.id::text,
      v_room.name || '''s founding trial at ' || v_room.venue || case
        when v_room.days_left < 0 then ' ended ' || -v_room.days_left || ' day(s) ago'
        when v_room.days_left = 0 then ' ends today'
        else ' ends in ' || v_room.days_left || ' day(s)'
      end,
      'Trial end date: ' || to_char(v_room.trial_ends_on, 'Mon DD') || '. Have the renewal conversation before it rolls over at the founding rate, then update the sponsor on the dashboard.');
  end loop;

  -- 14. Housekeeping: keep 30 days of client errors.
  delete from public.client_errors where created_at < now() - interval '30 days';

  -- Resolve watchdog conditions that didn't come up this run.
  update public.ops_events set resolved_at = now()
    where resolved_at is null and source = 'watchdog' and last_seen_at < v_run_started;

  insert into public.ops_heartbeat (name, last_run_at) values ('watchdog', now())
    on conflict (name) do update set last_run_at = excluded.last_run_at;
end;
$function$;

revoke execute on function public.ops_watchdog() from anon, authenticated, public;
