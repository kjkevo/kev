-- Perks: extra power-ups earned by leveling up (never sold). A player equips
-- one perk per game on top of their character's power; each is used once
-- per game.
--   Lv 3  time_freeze   +10 seconds on the clock (once 10s have passed)
--   Lv 7  streak_saver  one wrong answer doesn't break your 🔥 streak (on the phone)
--   Lv 12 comeback      after halfway, if your team is in the bottom half: +500
--   Lv 17 mirror        a Void Rift aimed at your team bounces back (automatic)
--   Lv 22 all_in        bet half your score: right doubles it, wrong loses it
--   Lv 27 xp_surge      1.5x XP for this game (automatic)

create table if not exists public.perks (
  key text primary key,
  name text not null,
  unlock_level int not null,
  sort int not null default 0
);
insert into public.perks (key, name, unlock_level, sort) values
  ('time_freeze', 'Time Freeze', 3, 1),
  ('streak_saver', 'Streak Saver', 7, 2),
  ('comeback', 'Comeback Kid', 12, 3),
  ('mirror', 'Mirror', 17, 4),
  ('all_in', 'All In', 22, 5),
  ('xp_surge', 'XP Surge', 27, 6)
on conflict (key) do update set name = excluded.name, unlock_level = excluded.unlock_level, sort = excluded.sort;
alter table public.perks enable row level security;
create policy "perks readable" on public.perks for select using (true);

alter table public.players add column if not exists perk text;

-- A perk being used (or going off) in a game. `amount` is points for the
-- team (All In: the bet, won or lost once the question is over).
create table if not exists public.trivia_perks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  question_id uuid,
  team_id uuid not null,
  player_id uuid not null,
  perk text not null,
  amount int not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists trivia_perks_once on public.trivia_perks(room_id, player_id);
create index if not exists trivia_perks_team on public.trivia_perks(team_id);
alter table public.trivia_perks enable row level security;
create policy "trivia perks readable" on public.trivia_perks for select using (true);
do $p$ begin
  alter publication supabase_realtime add table public.trivia_perks;
exception when others then null;
end $p$;

-- The level of the profile behind a phone.
create or replace function public.progress_level_for(p_device_key text) returns int
language sql stable security definer set search_path to 'public' as $$
  select public.progress_level(coalesce((select p.xp from public.profiles p
    join public.profile_devices d on d.profile_id = p.id where d.device_key = p_device_key), 0));
$$;

-- Perks and whether this phone has unlocked each.
create or replace function public.list_perks(p_device_key text)
returns table(o_key text, o_name text, o_unlock_level int, o_unlocked boolean)
language sql stable security definer set search_path to 'public' as $$
  select k.key, k.name, k.unlock_level, k.unlock_level <= public.progress_level_for(p_device_key)
  from public.perks k order by k.sort;
$$;

-- Equip a perk for this game (null = none). Only before you've used one.
create or replace function public.set_player_perk(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_perk text, p_device_key text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare v_level int;
begin
  if not exists (select 1 from public.players where id = p_player_id and room_id = p_room_id and client_token = p_client_token) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if exists (select 1 from public.trivia_perks where room_id = p_room_id and player_id = p_player_id) then
    raise exception 'PERK_USED';
  end if;
  if p_perk is not null then
    select unlock_level into v_level from public.perks where key = p_perk;
    if v_level is null then raise exception 'PERK_NOT_FOUND'; end if;
    if public.progress_level_for(p_device_key) < v_level then raise exception 'PERK_LOCKED'; end if;
  end if;
  update public.players set perk = p_perk where id = p_player_id;
end;
$function$;

-- Use your equipped perk on the current question (Time Freeze, Comeback Kid, All In).
create or replace function public.use_perk(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_question_id uuid)
returns table(o_perk text, o_amount int)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_room public.rooms;
  v_team uuid;
  v_perk text;
  v_rq public.room_questions;
  v_secs int;
  v_amount int := 0;
  v_total int;
  v_rank int;
  v_teams int;
  v_score int;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found or v_room.phase <> 'question' then raise exception 'NOT_ACCEPTING_ANSWERS'; end if;
  select pl.team_id, pl.perk into v_team, v_perk from public.players pl
    where pl.id = p_player_id and pl.room_id = p_room_id and pl.client_token = p_client_token and pl.left_at is null;
  if v_team is null then raise exception 'NOT_AUTHORIZED'; end if;
  if v_perk is null or v_perk not in ('time_freeze', 'comeback', 'all_in') then raise exception 'NO_PERK'; end if;
  if exists (select 1 from public.trivia_perks where room_id = p_room_id and player_id = p_player_id) then
    raise exception 'PERK_USED';
  end if;
  select * into v_rq from public.room_questions rq where rq.room_id = p_room_id and rq.order_index = v_room.current_question_index;
  if v_rq.question_id is distinct from p_question_id then raise exception 'STALE_QUESTION'; end if;
  v_secs := coalesce(v_rq.seconds, public.trivia_question_seconds(v_rq.order_index));
  if now() < v_room.question_started_at or now() >= v_room.question_started_at + make_interval(secs => v_secs) then
    raise exception 'TIME_EXPIRED';
  end if;

  perform 1 from public.teams where id = v_team for update;
  v_score := public.trivia_team_score(v_team);

  if v_perk = 'time_freeze' then
    if now() < v_room.question_started_at + interval '10 seconds' then raise exception 'TOO_EARLY'; end if;
    update public.rooms set question_started_at = question_started_at + interval '10 seconds',
      phase_started_at = phase_started_at + interval '10 seconds' where id = p_room_id;

  elsif v_perk = 'comeback' then
    select count(*) into v_total from public.room_questions where room_id = p_room_id;
    if v_room.current_question_index < v_total / 2 then raise exception 'TOO_EARLY'; end if;
    select count(*), count(*) filter (where public.trivia_team_score(t.id) > v_score) + 1 into v_teams, v_rank
      from public.teams t where t.room_id = p_room_id and exists (select 1 from public.players p where p.team_id = t.id);
    if v_rank <= ceil(v_teams / 2.0) then raise exception 'NOT_BEHIND'; end if;
    v_amount := 500;

  elsif v_perk = 'all_in' then
    if exists (select 1 from public.team_answers ta where ta.team_id = v_team and ta.question_id = p_question_id)
       or exists (select 1 from public.answers a join public.players pl on pl.id = a.player_id
                  where a.question_id = p_question_id and pl.team_id = v_team) then
      raise exception 'TEAM_LOCKED_IN';
    end if;
    v_amount := v_score / 2;
    if v_amount < 100 then raise exception 'NOTHING_TO_BET'; end if;
  end if;

  insert into public.trivia_perks (room_id, question_id, team_id, player_id, perk, amount)
    values (p_room_id, p_question_id, v_team, p_player_id, v_perk, v_amount);
  if v_perk = 'comeback' then
    update public.teams set score = public.trivia_team_score(id) where id = v_team;
  end if;
  return query select v_perk, v_amount;
end;
$function$;

-- Team score now includes perk points. All In counts once its question is
-- over: + the bet if the team got it right, - the bet if not.
create or replace function public.trivia_team_score(p_team_id uuid) returns integer
language sql stable security definer set search_path to 'public' as $function$
  select (coalesce((select sum(ta.points_awarded) from public.team_answers ta where ta.team_id = p_team_id), 0)
        + coalesce((select sum(p.amount) from public.trivia_powers p where p.team_id = p_team_id and p.power = 'rift'), 0)
        - coalesce((select sum(p.amount) from public.trivia_powers p where p.target_team_id = p_team_id and p.power = 'rift'), 0)
        + coalesce((select sum(case when k.perk = 'all_in' then
              case when coalesce((select ta.correct from public.team_answers ta
                                  where ta.team_id = k.team_id and ta.question_id = k.question_id), false)
                   then k.amount else -k.amount end
            else k.amount end)
          from public.trivia_perks k
          where k.team_id = p_team_id
            and not (k.perk = 'all_in' and exists (
              select 1 from public.rooms r join public.room_questions rq
                on rq.room_id = r.id and rq.order_index = r.current_question_index
              where r.id = k.room_id and r.phase = 'question' and rq.question_id = k.question_id))), 0))::int;
$function$;

-- Mirror: a Void Rift aimed at a team with an unused Mirror bounces back,
-- taking the points from the thief's team instead.
do $x$ declare d text; o text := '    v_data := jsonb_build_object(''target_name'', (select name from public.teams where id = v_target), ''amount'', v_amount);
'; begin
  d := pg_get_functiondef('public.use_power'::regproc);
  if position(o in d) = 0 then raise exception 'use_power: pattern missing'; end if;
  if position('mirror' in d) > 0 then return; end if;
  execute replace(d, o, o || $m$    declare v_mirror uuid; begin
      select pl.id into v_mirror from public.players pl
        where pl.team_id = v_target and pl.left_at is null and pl.perk = 'mirror'
          and not exists (select 1 from public.trivia_perks k where k.room_id = p_room_id and k.player_id = pl.id)
        limit 1;
      if v_mirror is not null then
        v_amount := -least(300, greatest(public.trivia_team_score(v_team), 0));
        insert into public.trivia_perks (room_id, question_id, team_id, player_id, perk, amount, data)
          values (p_room_id, p_question_id, v_target, v_mirror, 'mirror', 0, jsonb_build_object('from_team', v_team, 'amount', -v_amount));
        v_data := v_data || jsonb_build_object('mirrored', true, 'amount', -v_amount);
      end if;
    end;
$m$);
end $x$;

-- XP Surge: 1.5x XP for the game.
do $x$ declare d text; o text := '      + case when v_teams < 2 then 0 when rec.place = 1 then 50 when rec.place = 2 then 30 when rec.place = 3 then 15 else 0 end;
'; begin
  d := pg_get_functiondef('public.progress_record_room'::regproc);
  if position(o in d) = 0 then raise exception 'progress_record_room: pattern missing'; end if;
  if position('xp_surge' in d) > 0 then return; end if;
  if position('      select distinct on (p.device_key) p.device_key, p.nickname, p.avatar_id, p.team_id
' in d) = 0 then raise exception 'progress_record_room: select missing'; end if;
  d := replace(d, '      select distinct on (p.device_key) p.device_key, p.nickname, p.avatar_id, p.team_id
', '      select distinct on (p.device_key) p.device_key, p.nickname, p.avatar_id, p.team_id, p.perk
');
  execute replace(d, o, o || '    if rec.perk = ''xp_surge'' then v_xp := (v_xp * 3) / 2; end if;
');
end $x$;

do $g$ begin
  execute $q$re$q$ || $q$voke all on public.trivia_perks, public.perks from anon, authenticated$q$;
  execute $q$gr$q$ || $q$ant select on public.trivia_perks, public.perks to anon, authenticated$q$;
end $g$;
