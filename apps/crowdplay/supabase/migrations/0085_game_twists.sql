-- Game twists: 2-3 per game, at random spots, each announced on a 7-second
-- intro screen (phase 'twist_intro') before it plays, then back to regular
-- questions. Twist questions are always multiple choice.
--
--   lightning  3 questions in a row, 8 seconds each, double points
--   comeback   last place scores 1.5x on this question
--   bounty     1st place has a bounty: if they miss, every team that gets
--              it right collects +500
--   golden     triple points
--   captain    one player per team (the captain) answers for the team
--   sabotage   every team can throw one fog at another team; a fogged team
--              can't answer for 3 seconds (fogs stack)
--
-- Never on the first 3 questions or the last one, with at least 2 regular
-- questions between twists. Turn off with:
--   update feature_flags set enabled = false where key = 'trivia_twists';

insert into public.feature_flags (key, enabled) values ('trivia_twists', true)
  on conflict (key) do update set enabled = excluded.enabled;

-- Per question in a game: its twist, time and type (set when the game starts).
alter table public.room_questions
  add column if not exists twist text,
  add column if not exists twist_seq int,        -- 1, 2, 3 within a lightning round; 1 otherwise
  add column if not exists seconds int,          -- time on the clock
  add column if not exists is_open boolean,      -- typed answer (false: multiple choice)
  add column if not exists twist_teams uuid[],   -- comeback: last place; bounty: the leader
  add column if not exists captains jsonb;       -- captain: {team_id: player_id}

alter table public.team_answers add column if not exists bounty_paid boolean not null default false;

-- The 7-second intro screen before a twist.
alter table public.rooms drop constraint if exists rooms_phase_check;
alter table public.rooms add constraint rooms_phase_check
  check (phase = any (array['lobby', 'question', 'reveal', 'leaderboard', 'sudden_death', 'final', 'twist_intro']));

-- Sabotage fogs.
create table if not exists public.trivia_fogs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  question_id uuid not null,
  from_team uuid not null,
  to_team uuid not null,
  thrown_by uuid,
  thrown_at timestamptz not null default now(),
  unique (room_id, question_id, from_team)
);
alter table public.trivia_fogs enable row level security;
create policy "trivia fogs readable" on public.trivia_fogs for select using (true);
revoke all on public.trivia_fogs from anon, authenticated;
grant select on public.trivia_fogs to anon, authenticated;
alter publication supabase_realtime add table public.trivia_fogs;

-- Seconds for a question in a game (falls back to the old rule for games
-- that started before twists).
create or replace function public.trivia_rq_seconds(p_room_id uuid, p_order_index int)
returns int language sql stable set search_path to 'public' as $function$
  select coalesce(
    (select rq.seconds from public.room_questions rq where rq.room_id = p_room_id and rq.order_index = p_order_index),
    public.trivia_question_seconds(p_order_index));
$function$;

-- When a team's fog wears off: each fog adds 3 seconds, stacking.
create or replace function public.trivia_fog_until(p_room_id uuid, p_question_id uuid, p_team_id uuid)
returns timestamptz language plpgsql stable set search_path to 'public' as $function$
declare
  v_end timestamptz := '-infinity';
  f record;
begin
  for f in select thrown_at from public.trivia_fogs
           where room_id = p_room_id and question_id = p_question_id and to_team = p_team_id order by thrown_at loop
    v_end := greatest(v_end, f.thrown_at) + interval '3 seconds';
  end loop;
  return v_end;
end;
$function$;

-- Picks the twists for a game (run as it starts).
create or replace function public.trivia_plan_twists(p_room_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v_n int;
  v_k int;
  v_types text[];
  v_starts int[];
  v_lens int[];
  v_ok boolean := false;
  v_try int;
  i int;
  j int;
  s int;
  l int;
begin
  select count(*) into v_n from public.room_questions where room_id = p_room_id;
  update public.room_questions set twist = null, twist_seq = null, twist_teams = null, captains = null,
    is_open = (order_index % 3 = 2),
    seconds = public.trivia_question_seconds(order_index)
    where room_id = p_room_id;
  if not public.feature_on('trivia_twists') or v_n < 10 then
    return;
  end if;

  v_k := 2 + floor(random() * 2)::int; -- 2 or 3 twists
  select array_agg(t order by random()) into v_types
    from unnest(array['lightning', 'comeback', 'bounty', 'golden', 'captain', 'sabotage']) t;
  v_types := v_types[1:v_k];

  for v_try in 1..200 loop
    v_starts := '{}';
    v_lens := '{}';
    for i in 1..v_k loop
      l := case when v_types[i] = 'lightning' then 3 else 1 end;
      -- Start somewhere from Q4 on, ending before the last question.
      s := 3 + floor(random() * (v_n - 3 - l))::int;
      v_starts := v_starts || s;
      v_lens := v_lens || l;
    end loop;
    v_ok := true;
    for i in 1..v_k loop
      for j in 1..v_k loop
        -- At least 2 regular questions between twists.
        if i <> j and v_starts[j] >= v_starts[i] and v_starts[j] < v_starts[i] + v_lens[i] + 2 then
          v_ok := false;
        end if;
      end loop;
    end loop;
    exit when v_ok;
  end loop;
  if not v_ok then
    return;
  end if;

  for i in 1..v_k loop
    update public.room_questions set
      twist = v_types[i],
      twist_seq = order_index - v_starts[i] + 1,
      is_open = false,
      seconds = case when v_types[i] = 'lightning' then 8 else 20 end
    where room_id = p_room_id and order_index between v_starts[i] and v_starts[i] + v_lens[i] - 1;
  end loop;
end;
$function$;

-- Fills in who a twist is about, right before its intro screen: the
-- last-place team(s) for comeback, the leader for bounty, each team's
-- captain (a real player when there is one) for captain.
create or replace function public.trivia_twist_setup(p_room_id uuid, p_order_index int)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v_twist text;
begin
  select twist into v_twist from public.room_questions where room_id = p_room_id and order_index = p_order_index;
  if v_twist = 'comeback' then
    update public.room_questions set twist_teams = (
      select array_agg(t.id) from public.teams t
      where t.room_id = p_room_id
        and exists (select 1 from public.players pl where pl.team_id = t.id and pl.left_at is null)
        and t.score = (select min(t2.score) from public.teams t2 where t2.room_id = p_room_id
                         and exists (select 1 from public.players pl where pl.team_id = t2.id and pl.left_at is null)))
    where room_id = p_room_id and order_index = p_order_index;
  elsif v_twist = 'bounty' then
    update public.room_questions set twist_teams = array[(
      select t.id from public.teams t
      where t.room_id = p_room_id
        and exists (select 1 from public.players pl where pl.team_id = t.id and pl.left_at is null)
      order by t.score desc, t.created_at limit 1)]
    where room_id = p_room_id and order_index = p_order_index;
  elsif v_twist = 'captain' then
    update public.room_questions set captains = (
      select jsonb_object_agg(c.team_id, c.player_id) from (
        select distinct on (pl.team_id) pl.team_id, pl.id player_id
        from public.players pl
        where pl.room_id = p_room_id and pl.left_at is null and pl.team_id is not null
        order by pl.team_id, pl.is_bot, random()) c)
    where room_id = p_room_id and order_index = p_order_index;
  end if;
end;
$function$;

revoke execute on function public.trivia_plan_twists(uuid) from public, anon, authenticated;
revoke execute on function public.trivia_twist_setup(uuid, int) from public, anon, authenticated;

-- Throw your team's one fog at another team (sabotage questions only).
create or replace function public.throw_fog(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_target_team_id uuid)
returns table(o_fogged_until timestamptz)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_room public.rooms;
  v_team uuid;
  v_question uuid;
  v_twist text;
  v_secs int;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found or v_room.phase <> 'question' then
    raise exception 'NOT_ACCEPTING_ANSWERS';
  end if;
  select pl.team_id into v_team from public.players pl
    where pl.id = p_player_id and pl.room_id = p_room_id and pl.client_token = p_client_token and pl.left_at is null;
  if v_team is null then
    raise exception 'NOT_AUTHORIZED';
  end if;
  select rq.question_id, rq.twist, coalesce(rq.seconds, public.trivia_question_seconds(rq.order_index))
    into v_question, v_twist, v_secs
    from public.room_questions rq where rq.room_id = p_room_id and rq.order_index = v_room.current_question_index;
  if v_twist is distinct from 'sabotage' then
    raise exception 'NO_SABOTAGE';
  end if;
  if now() < v_room.question_started_at or now() >= v_room.question_started_at + make_interval(secs => v_secs) then
    raise exception 'TIME_EXPIRED';
  end if;
  if p_target_team_id = v_team or not exists (
    select 1 from public.teams t where t.id = p_target_team_id and t.room_id = p_room_id) then
    raise exception 'BAD_TARGET';
  end if;
  insert into public.trivia_fogs (room_id, question_id, from_team, to_team, thrown_by)
    values (p_room_id, v_question, v_team, p_target_team_id, p_player_id)
    on conflict (room_id, question_id, from_team) do nothing;
  if not found then
    raise exception 'ALREADY_THROWN';
  end if;
  return query select public.trivia_fog_until(p_room_id, v_question, p_target_team_id);
end;
$function$;
grant execute on function public.throw_fog(uuid, uuid, uuid, uuid) to anon, authenticated;

-- Points for a right answer: 500-1000 for speed, times the twist (lightning
-- 2x, golden 3x, comeback 1.5x for the last-place team), minus a hint.
create or replace function public.trivia_team_points(p_team_id uuid, p_question_id uuid)
returns integer language sql stable security definer set search_path to 'public' as $function$
  with q as (
    select rq.order_index, rq.twist, rq.twist_teams,
      coalesce(rq.seconds, public.trivia_question_seconds(rq.order_index)) secs
    from public.room_questions rq join public.teams t on t.room_id = rq.room_id
    where t.id = p_team_id and rq.question_id = p_question_id limit 1
  ), fastest as (
    select min(a.elapsed_ms) ms from public.answers a join public.players pl on pl.id = a.player_id
    where a.question_id = p_question_id and pl.team_id = p_team_id
      and public.trivia_vote_key(a.answer_text, p_question_id) = 'correct'
  )
  select greatest(0,
    round(
      (500 + 500 * (1 - least(greatest(coalesce((select ms from fastest), 0), 0), coalesce((select secs from q), 20) * 1000)::numeric
                        / (coalesce((select secs from q), 20) * 1000)))
      * case (select twist from q)
          when 'lightning' then 2
          when 'golden' then 3
          when 'comeback' then case when p_team_id = any(coalesce((select twist_teams from q), '{}')) then 1.5 else 1 end
          else 1 end
    )::int
    - case when exists (select 1 from public.team_hints h where h.team_id = p_team_id and h.question_id = p_question_id)
        then public.trivia_hint_cost(p_question_id) else 0 end);
$function$;

-- The function patches below (tick, scoring, voting, hints, bots,
-- watchdog, game start) were applied with pg_get_functiondef + replace;
-- see each block.

-- Scoring: pay the bounty once, if the leader missed.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.finalize_question_scoring'::regproc);
  d := replace(d,
$o$  update public.teams t set score = coalesce($o$,
$n$  -- Bounty: if the targeted leader missed, every team that got it right collects +500.
  if exists (select 1 from public.room_questions rq where rq.room_id = p_room_id and rq.question_id = v_question_id and rq.twist = 'bounty')
     and not exists (
       select 1 from public.team_answers ta
       join public.room_questions rq on rq.room_id = p_room_id and rq.question_id = v_question_id
       where ta.question_id = v_question_id and ta.team_id = any(coalesce(rq.twist_teams, '{}')) and ta.correct) then
    update public.team_answers ta set points_awarded = ta.points_awarded + 500, bounty_paid = true
      where ta.room_id = p_room_id and ta.question_id = v_question_id and ta.correct and not ta.bounty_paid
        and not ta.team_id = any(coalesce((select rq.twist_teams from public.room_questions rq
                                           where rq.room_id = p_room_id and rq.question_id = v_question_id), '{}'));
  end if;

  update public.teams t set score = coalesce($n$);
  if position('bounty_paid' in d) = 0 then raise exception 'finalize_question_scoring patch did not apply'; end if;
  execute d;
end $$;

-- Voting: only the captain answers on a captain question (unless they
-- left); a fogged team can't answer until the fog clears; per-game time.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.cast_team_vote'::regproc);
  d := replace(d, $o$  v_sample text;
begin$o$, $n$  v_sample text;
  v_twist text;
  v_captains jsonb;
begin$n$);
  d := replace(d, 'public.trivia_question_seconds(rq.order_index)', 'coalesce(rq.seconds, public.trivia_question_seconds(rq.order_index))');
  d := replace(d, $o$  if v_team is not null then
    perform 1 from public.teams where id = v_team for update;$o$,
$n$  select rq.twist, rq.captains into v_twist, v_captains from public.room_questions rq
    where rq.room_id = p_room_id and rq.order_index = v_room.current_question_index;
  if v_twist = 'captain' and v_team is not null and v_captains ? v_team::text
     and (v_captains->>v_team::text)::uuid <> p_player_id
     and exists (select 1 from public.players c where c.id = (v_captains->>v_team::text)::uuid and c.left_at is null) then
    raise exception 'NOT_CAPTAIN';
  end if;
  if v_twist = 'sabotage' and v_team is not null and public.trivia_fog_until(p_room_id, p_question_id, v_team) > now() then
    raise exception 'FOGGED';
  end if;

  if v_team is not null then
    perform 1 from public.teams where id = v_team for update;$n$);
  if position('NOT_CAPTAIN' in d) = 0 or position('coalesce(rq.seconds' in d) = 0 or position('v_captains jsonb' in d) = 0 then
    raise exception 'cast_team_vote patch did not apply';
  end if;
  execute d;
end $$;

-- Hints and the watchdog use the per-game time.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.use_team_hint'::regproc);
  d := replace(d, 'public.trivia_question_seconds(v_room.current_question_index)', 'public.trivia_rq_seconds(p_room_id, v_room.current_question_index)');
  if position('trivia_rq_seconds' in d) = 0 then raise exception 'use_team_hint patch did not apply'; end if;
  execute d;
  d := pg_get_functiondef('public.ops_watchdog'::regproc);
  d := replace(d, 'public.trivia_question_seconds(r.current_question_index)', 'public.trivia_rq_seconds(r.id, r.current_question_index)');
  if position('trivia_rq_seconds' in d) = 0 then raise exception 'ops_watchdog patch did not apply'; end if;
  execute d;
end $$;

-- Bots: per-game time, captains only on captain questions, and bot teams
-- throw their fog at the leader on sabotage questions.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.trivia_bot_autopilot'::regproc);
  d := replace(d, 'public.trivia_question_seconds((select ro2.current_question_index from public.rooms ro2 where ro2.id = b.room_id))',
                  'public.trivia_rq_seconds(b.room_id, (select ro2.current_question_index from public.rooms ro2 where ro2.id = b.room_id))');
  d := replace(d, $o$             and not exists (select 1 from answers a where a.player_id=p.id and a.question_id=q.id) loop$o$,
$n$             and not exists (select 1 from answers a where a.player_id=p.id and a.question_id=q.id)
             and (rq.captains is null or not (rq.captains ? p.team_id::text) or rq.captains->>p.team_id::text = p.id::text) loop$n$);
  d := replace(d, $o$  perform trivia_bot_sudden_death();$o$,
$n$  for b in select distinct on (p.team_id) p.id, p.client_token, p.team_id, ro.id room_id
           from players p join rooms ro on ro.id = p.room_id
           join room_questions rq on rq.room_id = ro.id and rq.order_index = ro.current_question_index
           where not ro.retired and ro.phase = 'question' and rq.twist = 'sabotage'
             and p.is_bot and p.left_at is null and p.team_id is not null
             and not exists (select 1 from players h where h.team_id = p.team_id and not h.is_bot)
             and not exists (select 1 from trivia_fogs f where f.room_id = ro.id and f.question_id = rq.question_id and f.from_team = p.team_id)
             and now() >= ro.question_started_at + make_interval(secs => 2 + abs(hashtext(p.team_id::text)) % 5)
           order by p.team_id loop
    begin
      perform throw_fog(b.room_id, b.id, b.client_token, (
        select t.id from teams t where t.room_id = b.room_id and t.id <> b.team_id
          and exists (select 1 from players pl where pl.team_id = t.id and pl.left_at is null)
        order by t.score desc, random() limit 1));
    exception when others then null;
    end;
  end loop;

  perform trivia_bot_sudden_death();$n$);
  if position('trivia_rq_seconds' in d) = 0 or position('rq.captains is null' in d) = 0 or position('throw_fog' in d) = 0 then
    raise exception 'autopilot patch did not apply';
  end if;
  execute d;
end $$;

-- Game start: plan the twists; a player left alone only moves onto a team
-- with real players (never onto a bot team, where bots could outvote them).
do $$
declare d text;
begin
  d := pg_get_functiondef('public.finalize_voting_and_start'::regproc);
  d := replace(d, $o$        and (not v_alone.is_bot or not exists (select 1 from public.players p2 where p2.team_id = t.id and p2.left_at is null
                                                 and not p2.is_bot))$o$,
$n$        and (case when v_alone.is_bot
                  then not exists (select 1 from public.players p2 where p2.team_id = t.id and p2.left_at is null and not p2.is_bot)
                  else exists (select 1 from public.players p2 where p2.team_id = t.id and p2.left_at is null and not p2.is_bot) end)$n$);
  d := replace(d, $o$  update public.rooms set
    winning_category_id = v_winner,$o$,
$n$  perform public.trivia_plan_twists(p_room_id);

  update public.rooms set
    winning_category_id = v_winner,$n$);
  if position('trivia_plan_twists' in d) = 0 or position('case when v_alone.is_bot' in d) = 0 then
    raise exception 'finalize_voting_and_start patch did not apply';
  end if;
  execute d;
end $$;

-- The game clock: per-game time; on captain questions only captains count
-- toward "everyone answered"; lightning reveals are 5s between its
-- questions; a twist gets its 7-second intro; idle-ending waits out twists.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.tick'::regproc);
  d := replace(d, $o$  v_next uuid;
begin$o$, $n$  v_next uuid;
  v_captains jsonb;
  v_twist_intro_seconds constant int := 7;
begin$n$);
  d := replace(d, $o$      select public.trivia_question_seconds(v_room.current_question_index), q.id into v_total, v_question_id$o$,
                  $o2$      select public.trivia_rq_seconds(v_room.id, v_room.current_question_index), q.id, rq.captains into v_total, v_question_id, v_captains$o2$);
  d := replace(d, $o$        select count(*) into v_active from public.players pl
          where pl.room_id = v_room.id and pl.left_at is null and pl.team_id is not null;$o$,
$n$        select count(*) into v_active from public.players pl
          where pl.room_id = v_room.id and pl.left_at is null and pl.team_id is not null
            and (v_captains is null or not (v_captains ? pl.team_id::text) or v_captains->>pl.team_id::text = pl.id::text);$n$);
  d := replace(d, $o$    elsif v_room.phase = 'reveal' then
      if now() >= v_room.phase_started_at + make_interval(secs => v_reveal_seconds) then$o$,
$n$    elsif v_room.phase = 'twist_intro' then
      -- The twist's intro screen has shown for 7 seconds: play it.
      if now() >= v_room.phase_started_at + make_interval(secs => v_twist_intro_seconds) then
        update public.rooms set phase = 'question', question_started_at = now(), phase_started_at = now()
          where id = v_room.id;
      end if;

    elsif v_room.phase = 'reveal' then
      if now() >= v_room.phase_started_at + make_interval(secs => case when exists (
           select 1 from public.room_questions a join public.room_questions b
             on b.room_id = a.room_id and b.order_index = a.order_index + 1
           where a.room_id = v_room.id and a.order_index = v_room.current_question_index
             and a.twist = 'lightning' and b.twist = 'lightning') then 5 else v_reveal_seconds end) then$n$);
  d := replace(d, $o$        if v_room.current_question_index >= 2
           and exists (select 1 from public.players pl where pl.room_id = v_room.id and not pl.is_bot)$o$,
$n$        if v_room.current_question_index >= 2
           and exists (select 1 from public.players pl where pl.room_id = v_room.id and not pl.is_bot)
           and not exists (select 1 from public.room_questions tq where tq.room_id = v_room.id and tq.twist is not null
                             and tq.order_index between v_room.current_question_index - 2 and v_room.current_question_index)$n$);
  d := replace(d, $o$        else
          update public.rooms set
            phase = 'question', current_question_index = v_room.current_question_index + 1,$o$,
$n$        elsif exists (select 1 from public.room_questions rq where rq.room_id = v_room.id
                        and rq.order_index = v_room.current_question_index + 1 and rq.twist is not null and rq.twist_seq = 1) then
          -- A game twist is next: show what it is first, then play it.
          perform public.trivia_twist_setup(v_room.id, v_room.current_question_index + 1);
          update public.rooms set
            phase = 'twist_intro', current_question_index = v_room.current_question_index + 1,
            question_started_at = now() + make_interval(secs => v_twist_intro_seconds),
            phase_started_at = now(), revealed_correct_index = null
          where id = v_room.id;
        else
          update public.rooms set
            phase = 'question', current_question_index = v_room.current_question_index + 1,$n$);
  if position('trivia_rq_seconds' in d) = 0 or position('v_captains ? pl.team_id' in d) = 0
     or position($p$phase = 'twist_intro'$p$ in d) = 0 or position('trivia_twist_setup' in d) = 0
     or position('tq.twist is not null' in d) = 0 or position($p$b.twist = 'lightning'$p$ in d) = 0 then
    raise exception 'tick patch did not apply';
  end if;
  execute d;
end $$;
