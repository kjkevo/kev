-- 1. Bots fill games up to 12 players again (while autoplay stays paused).
--    When a game starts with fewer than 12 players, bots join on their own
--    teams (never a real player's team, so they can't outvote anyone). Bots
--    don't sit in the lobby, and they don't add time to the lobby countdown.
--    Turn off with: update feature_flags set enabled = false where key = 'trivia_bot_topup';
--    A game where only bots answer for 3 questions in a row already ends
--    early (0077).
-- 2. The ops watchdog (every 10s) was taking ~1.2s a run and up to 49s,
--    slowing games down: it re-checked all 648 questions every run and
--    scanned a day of the game clock's run log. Now the question check runs
--    every 30 minutes, the clock check reads only the newest log rows, and the
--    log keeps about an hour.
insert into public.feature_flags (key, enabled) values ('trivia_bot_topup', true)
  on conflict (key) do update set enabled = excluded.enabled;

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
  v_need int;
  v_team uuid;
  v_name text;
  v_new uuid;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not public.feature_on('trivia_bot_topup') or v_room.phase <> 'lobby'
     or not exists (select 1 from public.players pl where pl.room_id = p_room_id and pl.left_at is null and not pl.is_bot) then
    return;
  end if;
  select v_fill_to - count(*) into v_need from public.players pl where pl.room_id = p_room_id and pl.left_at is null;
  -- Tells the lobby-countdown trigger these joins are bots.
  perform set_config('trivia.bot_join', '1', true);

  while v_need > 0 loop
    select n into v_name from unnest(v_names) n
      where not exists (select 1 from public.players pl where pl.room_id = p_room_id and lower(pl.nickname) = lower(n))
      order by random() limit 1;
    exit when v_name is null;
    -- Only bot teams with room; otherwise a new bot team.
    v_team := null;
    select t.id into v_team from public.teams t
      where t.room_id = p_room_id and not t.locked
        and exists (select 1 from public.players pl where pl.team_id = t.id and pl.left_at is null)
        and not exists (select 1 from public.players pl where pl.team_id = t.id and not pl.is_bot)
        and (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null) < v_team_target
      order by t.created_at limit 1;
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
  perform set_config('trivia.bot_join', '', true);
end;
$$;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.trivia_lobby_extend_on_join'::regproc);
  d := replace(d, $o$  if new.is_bot or public.feature_on('trivia_autoplay') then$o$,
                  $n$  if new.is_bot or public.feature_on('trivia_autoplay') or current_setting('trivia.bot_join', true) = '1' then$n$);
  if position('trivia.bot_join' in d) = 0 then raise exception 'trigger patch did not apply'; end if;
  execute d;
end $$;

do $$
declare d text; n int;
begin
  d := pg_get_functiondef('public.ops_watchdog'::regproc);
  n := length(d);
  -- Clock health: newest ~2000 log rows (several minutes) instead of a full scan.
  d := replace(d, 'from cron.job_run_details d where d.jobid = j.jobid',
                  'from (select * from cron.job_run_details order by runid desc limit 2000) d where d.jobid = j.jobid');
  -- Log trim: keep the newest ~20000 rows (about an hour), by id.
  d := replace(d,
$o$  select count(*) into v_n from (
    select 1 from cron.job_run_details where end_time < now() - interval '1 day' limit 50001
  ) s;
  if v_n > 0 then
    delete from cron.job_run_details where runid in (
      select runid from cron.job_run_details where end_time < now() - interval '1 day'
      order by runid limit 5000
    );
    if v_n > 50000 then$o$,
$n$  v_n := 0;
  delete from cron.job_run_details where runid in (
    select runid from cron.job_run_details
    where runid < (select max(runid) - 20000 from cron.job_run_details)
    order by runid limit 20000
  );
  if v_n > 0 then
    if v_n > 50000 then$n$);
  -- Question self-check: every 30 minutes, not every 10 seconds.
  d := replace(d,
$o$  select count(*) into v_n from public.questions q
    where q.active and ($o$,
$n$  v_n := 0;
  if not exists (select 1 from public.ops_heartbeat h where h.name = 'watchdog_questions' and h.last_run_at > now() - interval '30 minutes') then
  insert into public.ops_heartbeat (name, last_run_at) values ('watchdog_questions', now())
    on conflict (name) do update set last_run_at = excluded.last_run_at;
  select count(*) into v_n from public.questions q
    where q.active and ($n$);
  d := replace(d,
$o$      'Nothing changed automatically; the question or its alternatives need editing.');
  end if;$o$,
$n$      'Nothing changed automatically; the question or its alternatives need editing.');
  end if;
  end if;$n$);
  if position('watchdog_questions' in d) = 0 or position('limit 2000' in d) = 0 or position('max(runid) - 20000' in d) = 0 then
    raise exception 'ops_watchdog patch did not apply';
  end if;
  execute d;
end $$;
