-- Team rules and a longer lobby.
--   * At most 8 teams per game (teams with at least one active player).
--   * Teams hold 2 to 5 people, custom or auto-made.
--   * Solo players go on a random team that still has room: first any team
--     where someone is on their own, otherwise a new team while every team
--     already has 3+, otherwise the smallest team with space (ties broken
--     at random), so solo players spread evenly.
--   * At game start anyone still alone on a team is moved onto another team
--     with room (custom or auto), so nobody plays by themselves unless they
--     are the only one there.
--   * The lobby is open for 4 minutes instead of 2.

create or replace function public.trivia_live_team_count(p_room_id uuid)
returns int language sql stable security definer set search_path to 'public' as $function$
  select count(*)::int from public.teams t
  where t.room_id = p_room_id
    and exists (select 1 from public.players pl where pl.team_id = t.id and pl.left_at is null);
$function$;
revoke execute on function public.trivia_live_team_count(uuid) from anon, authenticated, public;

create or replace function public.auto_bucket_team(p_room_id uuid)
returns table(o_team_id uuid, o_team_name text)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_max_team_size constant int := 5;
  v_max_teams constant int := 8;
  v_found_id uuid;
  v_found_name text;
  v_next_num int;
  v_new_id uuid;
  v_new_name text;
begin
  -- 1. Someone on an auto team by themselves: keep them company.
  -- 2. Every auto team has 3+ (or there are none) and there's room: start a new one.
  -- 3. Otherwise a random auto team with space, then a random custom team with space.
  select t.id, t.name into v_found_id, v_found_name
    from public.teams t
    where t.room_id = p_room_id and t.kind = 'auto' and not t.locked
      and (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null) = 1
    order by random() limit 1
    for update of t;
  if v_found_id is not null then
    return query select v_found_id, v_found_name;
    return;
  end if;

  if public.trivia_live_team_count(p_room_id) < v_max_teams and not exists (
    select 1 from public.teams t
    where t.room_id = p_room_id and t.kind = 'auto' and not t.locked
      and (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null) between 1 and 2
  ) then
    select count(*) + 1 into v_next_num from public.teams t where t.room_id = p_room_id and t.kind = 'auto';
    loop
      v_new_name := 'Team ' || v_next_num;
      exit when not exists (select 1 from public.teams t where t.room_id = p_room_id and lower(t.name) = lower(v_new_name));
      v_next_num := v_next_num + 1;
    end loop;
    insert into public.teams (room_id, name, kind) values (p_room_id, v_new_name, 'auto')
      returning id into v_new_id;
    return query select v_new_id, v_new_name;
    return;
  end if;

  select t.id, t.name into v_found_id, v_found_name
    from public.teams t
    where t.room_id = p_room_id and not t.locked
      and (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null) between 1 and v_max_team_size - 1
    order by (t.kind = 'auto') desc,
      (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null), random()
    limit 1
    for update of t;
  if v_found_id is not null then
    return query select v_found_id, v_found_name;
    return;
  end if;

  raise exception 'ROOM_FULL';
end;
$function$;
revoke execute on function public.auto_bucket_team(uuid) from anon, authenticated, public;

create or replace function public.join_room(p_code text, p_nickname text, p_team_id uuid default null, p_new_team_name text default null)
returns table(player_id uuid, client_token uuid, room_id uuid, team_id uuid, team_name text)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_max_team_size constant int := 5;
  v_max_teams constant int := 8;
  v_room public.rooms;
  v_player public.players;
  v_team_id uuid;
  v_team_name text;
  v_member_count int;
  v_locked boolean;
  v_ip text;
begin
  select * into v_room from public.rooms where code = upper(p_code) for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.phase <> 'lobby' then
    raise exception 'ROOM_ALREADY_STARTED';
  end if;

  v_ip := nullif(trim(split_part(
    coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''),
    ',', 1
  )), '');
  if v_ip is not null and exists (
    select 1 from public.join_rate_limits jrl
    where jrl.ip = v_ip and jrl.last_join_at > now() - interval '5 seconds'
  ) then
    raise exception 'TOO_MANY_JOINS';
  end if;

  if length(trim(p_nickname)) < 1 or length(p_nickname) > 30 then
    raise exception 'INVALID_NICKNAME';
  end if;
  if exists (select 1 from public.players pl where pl.room_id = v_room.id and lower(pl.nickname) = lower(trim(p_nickname))) then
    raise exception 'NICKNAME_TAKEN';
  end if;

  if p_new_team_name is not null and length(trim(p_new_team_name)) > 0 then
    if length(trim(p_new_team_name)) > 30 then
      raise exception 'INVALID_TEAM_NAME';
    end if;
    if public.trivia_live_team_count(v_room.id) >= v_max_teams then
      raise exception 'TOO_MANY_TEAMS';
    end if;
    if exists (select 1 from public.teams t where t.room_id = v_room.id and lower(t.name) = lower(trim(p_new_team_name))) then
      raise exception 'TEAM_NAME_TAKEN';
    end if;
    insert into public.teams (room_id, name, kind) values (v_room.id, trim(p_new_team_name), 'self')
      returning id, name into v_team_id, v_team_name;

  elsif p_team_id is not null then
    select t.id, t.name, t.locked into v_team_id, v_team_name, v_locked
      from public.teams t where t.id = p_team_id and t.room_id = v_room.id for update;
    if v_team_id is null then
      raise exception 'TEAM_NOT_FOUND';
    end if;
    if v_locked then
      raise exception 'TEAM_LOCKED';
    end if;
    select count(*) into v_member_count from public.players pl
      where pl.team_id = v_team_id and pl.left_at is null;
    if v_member_count >= v_max_team_size then
      raise exception 'TEAM_FULL';
    end if;
    if v_member_count = 0 and public.trivia_live_team_count(v_room.id) >= v_max_teams then
      raise exception 'TOO_MANY_TEAMS';
    end if;

  else
    select o_team_id, o_team_name into v_team_id, v_team_name from public.auto_bucket_team(v_room.id);
  end if;

  insert into public.players (room_id, nickname, team_id)
    values (v_room.id, trim(p_nickname), v_team_id)
    returning * into v_player;

  if v_ip is not null then
    insert into public.join_rate_limits (ip, last_join_at) values (v_ip, now())
      on conflict (ip) do update set last_join_at = excluded.last_join_at;
  end if;

  return query select v_player.id, v_player.client_token, v_player.room_id, v_team_id, v_team_name;
exception when unique_violation then
  raise exception 'NICKNAME_TAKEN';
end;
$function$;
grant execute on function public.join_room(text, text, uuid, text) to anon, authenticated;

create or replace function public.finalize_voting_and_start(p_room_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v_max_team_size constant int := 5;
  v_room public.rooms;
  v_winner uuid;
  v_question_ids uuid[];
  v_questions_per_game constant int := 20;
  v_per_difficulty constant int := 10;
  v_alone record;
  v_target uuid;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or v_room.phase <> 'lobby' then
    return;
  end if;

  -- Nobody plays alone if another team has room: move anyone still on a
  -- team by themselves onto a random team with space.
  for v_alone in
    select pl.id player_id, pl.team_id from public.players pl
    where pl.room_id = p_room_id and pl.left_at is null and pl.team_id is not null
      and (select count(*) from public.players p2 where p2.team_id = pl.team_id and p2.left_at is null) = 1
    order by pl.joined_at
  loop
    -- Someone earlier in this loop may have joined them already.
    continue when (select count(*) from public.players p2 where p2.team_id = v_alone.team_id and p2.left_at is null) <> 1;
    select t.id into v_target from public.teams t
      where t.room_id = p_room_id and t.id <> v_alone.team_id
        and (select count(*) from public.players p2 where p2.team_id = t.id and p2.left_at is null) between 1 and v_max_team_size - 1
      order by random() limit 1;
    if v_target is not null then
      update public.players set team_id = v_target where id = v_alone.player_id;
    end if;
  end loop;
  delete from public.teams t where t.room_id = p_room_id
    and not exists (select 1 from public.players pl where pl.team_id = t.id);

  update public.teams set locked = true where room_id = p_room_id;

  select cv.choice_pack_id into v_winner
    from public.category_votes cv
    where cv.room_id = p_room_id and cv.choice_pack_id is not null
    group by cv.choice_pack_id
    order by count(*) desc, random()
    limit 1;

  if v_winner is null and v_room.category_options is not null then
    v_winner := v_room.category_options[1 + floor(random() * array_length(v_room.category_options, 1))::int];
  end if;

  with candidates as (
    select distinct on (lower(q.prompt)) q.id, q.difficulty, q.last_used_at
    from public.questions q
    where q.pack_id = v_winner and q.active
    order by lower(q.prompt), q.last_used_at nulls first, random()
  ), ranked as (
    select c.id, c.last_used_at,
           row_number() over (partition by c.difficulty order by c.last_used_at nulls first, random()) as rn
    from candidates c
  ), picked as (
    select r.id, 0 as pass, r.rn, r.last_used_at from ranked r where r.rn <= v_per_difficulty
    union all
    select r.id, 1, r.rn, r.last_used_at from ranked r where r.rn > v_per_difficulty
  ), limited as (
    select p.id from picked p
    order by p.pass, p.last_used_at nulls first, random()
    limit v_questions_per_game
  )
  select array_agg(l.id order by random()) into v_question_ids from limited l;

  update public.questions set last_used_at = now() where id = any(v_question_ids);

  insert into public.room_questions (room_id, order_index, question_id)
  select p_room_id, ord - 1, qid from unnest(v_question_ids) with ordinality as t(qid, ord);

  update public.rooms set
    winning_category_id = v_winner,
    phase = 'question',
    current_question_index = 0,
    question_started_at = now(),
    phase_started_at = now(),
    revealed_correct_index = null
  where id = p_room_id;
end;
$function$;

create or replace function public.restart_trivia_now(p_venue text default 'main')
returns table(room_id uuid, code text)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_venue public.venues;
  v_room_id uuid;
  v_code text;
begin
  v_venue := public.venue_by_slug(p_venue);
  if v_venue.id is null then
    raise exception 'VENUE_NOT_FOUND';
  end if;
  update public.rooms set retired = true, phase = 'final', phase_started_at = now()
    where not retired and venue_id = v_venue.id;

  select cr.room_id, cr.code into v_room_id, v_code
    from public.create_room(now() + make_interval(secs => 240), v_venue.id) cr;

  return query select v_room_id, v_code;
end;
$function$;

-- Game clock and watchdog: open new lobbies for 4 minutes (was 2). Only the
-- lobby length changes, so patch the live definitions in place.
do $$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.tick()'::regprocedure);
  if position('v_lobby_boarding_seconds constant int := 120;' in v_def) = 0 then
    raise exception 'tick() lobby constant not found';
  end if;
  execute replace(v_def, 'v_lobby_boarding_seconds constant int := 120;', 'v_lobby_boarding_seconds constant int := 240;');

  v_def := pg_get_functiondef('public.ops_watchdog()'::regprocedure);
  if position('interval ''120 seconds''' in v_def) = 0 then
    raise exception 'ops_watchdog() lobby interval not found';
  end if;
  v_def := replace(v_def, 'interval ''120 seconds''', 'interval ''240 seconds''');
  v_def := replace(v_def, 'start in 2 minutes', 'start in 4 minutes');
  v_def := replace(v_def, 'starting in 2 minutes', 'starting in 4 minutes');
  execute v_def;
end;
$$;
