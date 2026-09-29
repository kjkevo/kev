-- Every player needs a character equipped to join any game (trivia, feud,
-- bingo). New phones are asked to pick one of the two free characters.

alter table public.feud_players add column if not exists avatar_id text references public.avatars(id);
alter table public.bingo_players add column if not exists avatar_id text references public.avatars(id);

-- Raises unless this phone may wear the character: it exists and is free
-- or unlocked on this phone.
create or replace function public.check_avatar(p_avatar_id text, p_device_key text)
returns void
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_price int;
begin
  if p_avatar_id is null or p_avatar_id = '' then
    raise exception 'AVATAR_REQUIRED';
  end if;
  select price_cents into v_price from public.avatars where id = p_avatar_id and active;
  if v_price is null then
    raise exception 'AVATAR_NOT_FOUND';
  end if;
  if v_price > 0 and not exists (select 1 from public.avatar_unlocks u where u.device_key = p_device_key and u.avatar_id = p_avatar_id) then
    raise exception 'AVATAR_LOCKED';
  end if;
end;
$$;

drop function if exists public.join_room(text, text, uuid, text);
create function public.join_room(p_code text, p_nickname text, p_team_id uuid default null, p_new_team_name text default null,
                                 p_avatar_id text default null, p_device_key text default null)
returns table(player_id uuid, client_token uuid, room_id uuid, team_id uuid, team_name text)
language plpgsql
security definer
set search_path to 'public'
as $$
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

  perform public.check_avatar(p_avatar_id, p_device_key);

  v_ip := nullif(trim(split_part(
    coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''),
    ',', 1
  )), '');
  if v_ip is not null and exists (
    select 1 from public.join_rate_limits jrl
    where jrl.ip = v_ip and jrl.window_started_at > now() - interval '1 minute' and jrl.join_count >= 20
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

  insert into public.players (room_id, nickname, team_id, avatar_id, device_key)
    values (v_room.id, trim(p_nickname), v_team_id, p_avatar_id, nullif(p_device_key, ''))
    returning * into v_player;

  if v_ip is not null then
    insert into public.join_rate_limits (ip, last_join_at, window_started_at, join_count) values (v_ip, now(), now(), 1)
      on conflict (ip) do update set
        last_join_at = excluded.last_join_at,
        join_count = case when public.join_rate_limits.window_started_at > now() - interval '1 minute'
                          then public.join_rate_limits.join_count + 1 else 1 end,
        window_started_at = case when public.join_rate_limits.window_started_at > now() - interval '1 minute'
                                 then public.join_rate_limits.window_started_at else now() end;
  end if;

  return query select v_player.id, v_player.client_token, v_player.room_id, v_team_id, v_team_name;
exception when unique_violation then
  raise exception 'NICKNAME_TAKEN';
end;
$$;
grant execute on function public.join_room(text, text, uuid, text, text, text) to anon, authenticated;

drop function if exists public.join_feud_room(text, text, text);
create function public.join_feud_room(p_code text, p_nickname text, p_team text default null,
                                      p_avatar_id text default null, p_device_key text default null)
returns table(player_id uuid, client_token uuid, room_id uuid, team text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_room public.feud_rooms;
  v_player public.feud_players;
  v_team text;
  v_team_a_count int;
  v_team_b_count int;
begin
  select * into v_room from public.feud_rooms where code = upper(p_code) for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  perform public.check_avatar(p_avatar_id, p_device_key);
  if length(trim(p_nickname)) < 1 or length(p_nickname) > 30 then
    raise exception 'INVALID_NICKNAME';
  end if;

  select count(*) filter (where pl.team = 'a'), count(*) filter (where pl.team = 'b')
    into v_team_a_count, v_team_b_count
    from public.feud_players pl where pl.room_id = v_room.id;

  if v_team_a_count >= 25 and v_team_b_count >= 25 then
    raise exception 'ROOM_FULL';
  end if;

  if p_team in ('a', 'b') and (case when p_team = 'a' then v_team_a_count else v_team_b_count end) < 25 then
    v_team := p_team;
  else
    v_team := case
      when v_team_a_count >= 25 then 'b'
      when v_team_b_count >= 25 then 'a'
      when v_team_a_count <= v_team_b_count then 'a'
      else 'b'
    end;
  end if;

  insert into public.feud_players (room_id, team, nickname, avatar_id)
    values (v_room.id, v_team, trim(p_nickname), p_avatar_id)
    returning * into v_player;

  return query select v_player.id, v_player.client_token, v_player.room_id, v_player.team;
exception when unique_violation then
  raise exception 'NICKNAME_TAKEN';
end;
$$;
grant execute on function public.join_feud_room(text, text, text, text, text) to anon, authenticated;

drop function if exists public.join_bingo_room(text, text);
create function public.join_bingo_room(p_code text, p_nickname text,
                                       p_avatar_id text default null, p_device_key text default null)
returns table(player_id uuid, client_token uuid, room_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_room public.bingo_rooms;
  v_player public.bingo_players;
  v_existing_count int;
  v_card jsonb := '[]'::jsonb;
  v_marked jsonb := '[]'::jsonb;
begin
  select * into v_room from public.bingo_rooms where code = upper(p_code) for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  perform public.check_avatar(p_avatar_id, p_device_key);
  if length(trim(p_nickname)) < 1 or length(p_nickname) > 30 then
    raise exception 'INVALID_NICKNAME';
  end if;

  select count(*) into v_existing_count from public.bingo_players bp where bp.room_id = v_room.id;
  if v_existing_count >= 50 then
    raise exception 'ROOM_FULL';
  end if;

  if v_room.phase = 'playing' then
    v_card := public.random_bingo_card();
    v_marked := public.default_bingo_marked();
  end if;

  insert into public.bingo_players (room_id, nickname, card, marked, avatar_id)
    values (v_room.id, trim(p_nickname), v_card, v_marked, p_avatar_id)
    returning * into v_player;

  return query select v_player.id, v_player.client_token, v_player.room_id;
exception when unique_violation then
  raise exception 'NICKNAME_TAKEN';
end;
$$;
grant execute on function public.join_bingo_room(text, text, text, text) to anon, authenticated;

-- Test bots wear the free characters too.
create or replace function public.trivia_bot_autopilot()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare b record; r record; ans text; acc numeric; v_team uuid;
begin
  for r in select ro.id, ro.code from rooms ro join venues ve on ve.id = ro.venue_id and ve.active and ve.test_bots
           where not ro.retired and ro.phase='lobby'
             and not exists (select 1 from players p where p.room_id=ro.id and p.nickname like 'BOT %') loop
    perform join_room(r.code, 'BOT Ava', null, 'Quizzly Bears', 'jungle-scout', null);
    select id into v_team from teams where room_id=r.id and name='Quizzly Bears';
    perform join_room(r.code, 'BOT Ben', v_team, null, 'crystal-titan', null);
    perform join_room(r.code, 'BOT Cleo', v_team, null, 'jungle-scout', null);
    perform join_room(r.code, n, null, null, case when hashtext(n) % 2 = 0 then 'jungle-scout' else 'crystal-titan' end, null)
      from unnest(array['BOT Fay','BOT Gus','BOT Hana','BOT Ivan','BOT Jo','BOT Dev']) n;
  end loop;
  for b in select p.id, p.client_token, ro.id room_id, ro.category_options opts from players p join rooms ro on ro.id=p.room_id
           where not ro.retired and ro.phase='lobby' and p.nickname like 'BOT %' and p.left_at is null
             and not exists (select 1 from category_votes cv where cv.player_id=p.id)
             and exists (select 1 from players h where h.room_id=ro.id and h.nickname not like 'BOT %' and h.left_at is null)
             and not exists (select 1 from players h where h.room_id=ro.id and h.nickname not like 'BOT %' and h.left_at is null
                             and not exists (select 1 from category_votes cv where cv.player_id=h.id)) loop
    perform cast_vote(b.room_id, b.id, b.client_token, b.opts[1 + floor(random()*array_length(b.opts,1))::int]);
  end loop;
  for b in select p.id, p.client_token, p.nickname, ro.id room_id, q.id qid, q.choices, q.correct_index, q.difficulty
           from players p join rooms ro on ro.id=p.room_id
           join room_questions rq on rq.room_id=ro.id and rq.order_index=ro.current_question_index
           join questions q on q.id=rq.question_id
           where not ro.retired and ro.phase='question' and p.nickname like 'BOT %' and p.left_at is null
             and now() >= ro.question_started_at + make_interval(secs => 3 + abs(hashtext(p.id::text || q.id::text)) % 15)
             and not exists (select 1 from answers a where a.player_id=p.id and a.question_id=q.id) loop
    acc := 0.4 + (abs(hashtext(b.nickname)) % 50) / 100.0 - case when b.difficulty='hard' then 0.3 else 0 end;
    if random() < acc then
      ans := b.choices->>b.correct_index;
      if random() < 0.2 and length(ans) > 5 then ans := overlay(ans placing '' from 3 + floor(random()*(length(ans)-4))::int for 1); end if;
    else
      ans := b.choices->>((b.correct_index + 1 + floor(random()*3)::int) % 4);
    end if;
    begin perform cast_team_vote(b.room_id, b.id, b.client_token, b.qid, lower(ans)); exception when others then null; end;
  end loop;
end $$;
