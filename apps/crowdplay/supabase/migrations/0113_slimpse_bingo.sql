-- Slimpse Bingo: a fresh bingo game (the old bingo_* tables are untouched).
-- Every bar always has a Solo game and a Team game. Each team (a solo player
-- is a team of one) has one 5x5 card (B 1-15, I 16-30, N 31-45, G 46-60,
-- O 61-75, free middle); numbers are called every 6 seconds and players tap
-- them on their card. The first team to tap BINGO with a full line wins.
-- Teammates share one card: anyone on the team can mark it.
-- Slimpse twist: each player brings one power-up (once per game):
--   wild   Wild Square  mark any square, called or not   (Level 1)
--   peek   Sneak Peek   see the next number before it's called (Level 3)
--   fresh  Fresh Card   swap for a brand-new card, first 5 calls only (Level 6)
-- Empty seats are filled by computer players (solo: up to 6 players; team:
-- at least 3 teams). Finishing earns XP like Trivia (20, +60 for the win).

create table if not exists public.sb_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  venue_id uuid not null,
  mode text not null check (mode in ('solo', 'team')),
  phase text not null default 'lobby' check (phase in ('lobby', 'playing', 'final')),
  starts_at timestamptz,
  deck int[] not null default '{}',
  calls int[] not null default '{}',
  last_call_at timestamptz,
  winner_team_id uuid,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists sb_rooms_open on public.sb_rooms(venue_id, mode, phase);

create table if not exists public.sb_teams (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.sb_rooms(id) on delete cascade,
  name text not null,
  is_bot boolean not null default false,
  card int[] not null,
  marks boolean[] not null,
  bot_bingo_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists sb_teams_room on public.sb_teams(room_id);

create table if not exists public.sb_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.sb_rooms(id) on delete cascade,
  team_id uuid not null references public.sb_teams(id) on delete cascade,
  client_token uuid not null default gen_random_uuid(),
  nickname text not null,
  avatar_id text,
  device_key text,
  is_bot boolean not null default false,
  power text,
  power_used_at timestamptz,
  power_data jsonb,
  joined_at timestamptz not null default now(),
  left_at timestamptz
);
create index if not exists sb_players_room on public.sb_players(room_id);

alter table public.sb_rooms enable row level security;
alter table public.sb_teams enable row level security;
alter table public.sb_players enable row level security;
do $g$ begin
  execute $q$re$q$ || $q$voke all on public.sb_rooms, public.sb_teams, public.sb_players from anon, authenticated$q$;
end $g$;

create or replace function public.sb_letter(n int) returns text
language sql immutable as $$ select substr('BINGO', ((n - 1) / 15) + 1, 1); $$;

-- A fresh card: 5 random numbers from each column's range, middle is free (0).
create or replace function public.sb_new_card() returns int[]
language plpgsql volatile as $$
declare
  c int; r int;
  col int[];
  card int[] := array_fill(0, array[25]);
begin
  for c in 0..4 loop
    select array_agg(x) into col from (
      select x from generate_series(c * 15 + 1, c * 15 + 15) x order by random() limit 5) s;
    for r in 0..4 loop
      card[r * 5 + c + 1] := col[r + 1];
    end loop;
  end loop;
  card[13] := 0;
  return card;
end;
$$;

create or replace function public.sb_blank_marks() returns boolean[]
language sql immutable as $$ select array_fill(false, array[12]) || array[true] || array_fill(false, array[12]); $$;

-- Does this card have a full row, column or diagonal marked?
create or replace function public.sb_has_line(m boolean[]) returns boolean
language sql immutable as $$
  select exists (
    select 1 from (values
      (array[1,2,3,4,5]), (array[6,7,8,9,10]), (array[11,12,13,14,15]), (array[16,17,18,19,20]), (array[21,22,23,24,25]),
      (array[1,6,11,16,21]), (array[2,7,12,17,22]), (array[3,8,13,18,23]), (array[4,9,14,19,24]), (array[5,10,15,20,25]),
      (array[1,7,13,19,25]), (array[5,9,13,17,21])) l(idx)
    where (select bool_and(m[i]) from unnest(l.idx) i)
  );
$$;

create or replace function public.sb_team_name() returns text
language sql volatile as $$
  select (array['Full House', 'Lucky Daubers', 'Line Hunters', 'Free Spacers', 'Number Crunchers',
                'B-Sharp', 'The Callers', 'Dot Com', 'Four Corners', 'Blackout Crew',
                'O-Seventy', 'Card Sharks', 'Bingo Bandits', 'Dab Squad', 'Hot Numbers'])[1 + floor(random() * 15)::int];
$$;

-- The open game a phone should join (made if needed): Solo takes players
-- until it ends (up to 30 people); Team only before it starts (up to 8 teams).
create or replace function public.sb_open(p_venue text, p_mode text)
returns table(o_code text)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v public.venues;
  v_code text;
begin
  if p_mode not in ('solo', 'team') then raise exception 'BAD_MODE'; end if;
  v := public.venue_by_slug(coalesce(p_venue, 'main'));
  if v.id is null then select * into v from public.venues where slug = 'main'; end if;
  select r.code into v_code from public.sb_rooms r
    where r.venue_id = v.id and r.mode = p_mode
      and (r.phase = 'lobby' or (p_mode = 'solo' and r.phase = 'playing' and coalesce(array_length(r.calls, 1), 0) < 45))
      and (select count(*) from public.sb_players p where p.room_id = r.id and not p.is_bot and p.left_at is null) < 30
      and (p_mode = 'solo' or (select count(*) from public.sb_teams t where t.room_id = r.id) < 8)
    order by r.created_at limit 1;
  if v_code is null then
    loop
      v_code := upper(substr(md5(random()::text), 1, 5));
      exit when not exists (select 1 from public.sb_rooms where code = v_code);
    end loop;
    insert into public.sb_rooms (code, venue_id, mode) values (v_code, v.id, p_mode);
  end if;
  return query select v_code;
end;
$function$;

-- Join a game. Team play: pass p_team_id to join a friend's team (from their
-- QR code), or leave it empty to start your own team. Solo: always your own card.
create or replace function public.sb_join(p_code text, p_nickname text, p_avatar_id text, p_device_key text, p_team_id uuid default null)
returns table(o_room_id uuid, o_player_id uuid, o_client_token uuid, o_team_id uuid)
language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.sb_rooms;
  v_team uuid;
  v_player uuid;
  v_token uuid;
  v_name text := left(btrim(coalesce(p_nickname, '')), 30);
begin
  select * into r from public.sb_rooms where code = upper(p_code);
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if r.phase = 'final' then raise exception 'GAME_OVER'; end if;
  if v_name = '' then raise exception 'NAME_REQUIRED'; end if;
  perform public.check_avatar(p_avatar_id, p_device_key);

  -- Already in this game on this phone: hand back the same seat.
  select p.id, p.client_token, p.team_id into v_player, v_token, v_team from public.sb_players p
    where p.room_id = r.id and p.device_key = p_device_key and not p.is_bot order by p.joined_at desc limit 1;
  if v_player is not null then
    update public.sb_players set left_at = null, avatar_id = p_avatar_id, nickname = v_name where id = v_player;
    return query select r.id, v_player, v_token, v_team;
    return;
  end if;
  if r.mode = 'team' and r.phase <> 'lobby' then raise exception 'ALREADY_STARTED'; end if;

  if r.mode = 'team' and p_team_id is not null then
    select t.id into v_team from public.sb_teams t where t.id = p_team_id and t.room_id = r.id and not t.is_bot
      and (select count(*) from public.sb_players p where p.team_id = t.id and p.left_at is null) < 4;
    if v_team is null then raise exception 'TEAM_FULL'; end if;
  else
    insert into public.sb_teams (room_id, name, card, marks)
      values (r.id, case when r.mode = 'solo' then v_name else public.sb_team_name() end, public.sb_new_card(), public.sb_blank_marks())
      returning id into v_team;
  end if;
  insert into public.sb_players (room_id, team_id, nickname, avatar_id, device_key)
    values (r.id, v_team, v_name, p_avatar_id, p_device_key) returning id, client_token into v_player, v_token;
  -- The first real player starts the lobby clock.
  if r.phase = 'lobby' and r.starts_at is null then
    update public.sb_rooms set starts_at = now() + interval '40 seconds' where id = r.id;
  end if;
  return query select r.id, v_player, v_token, v_team;
end;
$function$;

create or replace function public.sb_auth(p_room_id uuid, p_player_id uuid, p_client_token uuid) returns public.sb_players
language plpgsql stable security definer set search_path to 'public' as $function$
declare p public.sb_players;
begin
  select * into p from public.sb_players where id = p_player_id and room_id = p_room_id and client_token = p_client_token;
  if not found then raise exception 'NOT_AUTHORIZED'; end if;
  return p;
end;
$function$;

-- Everything a phone needs to draw the game (polled every second or two).
create or replace function public.sb_state(p_room_id uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'room', (select jsonb_build_object('id', r.id, 'code', r.code, 'mode', r.mode, 'phase', r.phase,
              'starts_at', r.starts_at, 'calls', r.calls, 'last_call_at', r.last_call_at,
              'winner_team_id', r.winner_team_id, 'ended_at', r.ended_at, 'now', now(),
              'venue', (select slug from public.venues v where v.id = r.venue_id))
             from public.sb_rooms r where r.id = p_room_id),
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'is_bot', t.is_bot,
              'card', t.card, 'marks', t.marks) order by t.created_at) from public.sb_teams t where t.room_id = p_room_id), '[]'),
    'players', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'team_id', p.team_id, 'nickname', p.nickname,
              'avatar_id', p.avatar_id, 'is_bot', p.is_bot, 'power', p.power, 'power_used', p.power_used_at is not null,
              'left', p.left_at is not null) order by p.joined_at) from public.sb_players p where p.room_id = p_room_id), '[]'));
$$;

-- Tap a square. Only numbers already called can be marked (unless it's your
-- Wild Square). Tapping a marked square unmarks it.
create or replace function public.sb_mark(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_index int)
returns boolean[] language plpgsql security definer set search_path to 'public' as $function$
declare
  p public.sb_players := public.sb_auth(p_room_id, p_player_id, p_client_token);
  r public.sb_rooms;
  t public.sb_teams;
begin
  select * into r from public.sb_rooms where id = p_room_id;
  if r.phase <> 'playing' then raise exception 'NOT_PLAYING'; end if;
  if p_index < 1 or p_index > 25 or p_index = 13 then raise exception 'BAD_SQUARE'; end if;
  select * into t from public.sb_teams where id = p.team_id for update;
  if t.marks[p_index] then
    t.marks[p_index] := false;
  else
    if not (t.card[p_index] = any(r.calls)) then raise exception 'NOT_CALLED'; end if;
    t.marks[p_index] := true;
  end if;
  update public.sb_teams set marks = t.marks where id = t.id;
  return t.marks;
end;
$function$;

-- Award XP when a game ends (same tables as Trivia, so levels and the
-- leaderboard count Bingo too).
create or replace function public.sb_record_progress(p_room_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.sb_rooms;
  v public.venues;
  rec record;
  v_profile uuid;
  v_xp int;
  v_won boolean;
  v_day date;
  v_new int;
begin
  select * into r from public.sb_rooms where id = p_room_id;
  select * into v from public.venues where id = r.venue_id;
  v_day := (now() at time zone coalesce(v.timezone, 'America/Chicago'))::date;
  for rec in select distinct on (p.device_key) p.* from public.sb_players p
             where p.room_id = p_room_id and not p.is_bot and p.device_key is not null order by p.device_key, p.joined_at desc loop
    v_profile := public.progress_profile_for(rec.device_key);
    perform public.progress_touch_profile(v_profile);
    v_won := rec.team_id = r.winner_team_id;
    v_xp := 20 + case when v_won then 60 else 0 end;
    insert into public.profile_games (profile_id, room_id, venue_id, area, played_on, played_at, xp, correct, place, won)
      values (v_profile, p_room_id, r.venue_id, coalesce(v.area, 'Chicago'), v_day, now(), v_xp, 0, case when v_won then 1 end, coalesce(v_won, false))
      on conflict do nothing;
    get diagnostics v_new = row_count;
    if v_new > 0 then
      update public.profiles pr set xp = pr.xp + v_xp, games = pr.games + 1, wins = pr.wins + case when v_won then 1 else 0 end,
        streak = public.progress_next_streak(pr.last_play_day, pr.streak, v_day),
        best_streak = greatest(pr.best_streak, public.progress_next_streak(pr.last_play_day, pr.streak, v_day)),
        last_play_day = greatest(coalesce(pr.last_play_day, v_day), v_day),
        display_name = regexp_replace(rec.nickname, ' ·[0-9a-z]{4}$', ''), avatar_id = coalesce(rec.avatar_id, pr.avatar_id)
      where pr.id = v_profile;
    end if;
  end loop;
end;
$function$;

create or replace function public.sb_finish(p_room_id uuid, p_winner uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  update public.sb_rooms set phase = 'final', winner_team_id = p_winner, ended_at = now()
    where id = p_room_id and phase = 'playing';
  if found then
    begin
      perform public.sb_record_progress(p_room_id);
    exception when others then
      raise warning 'sb_record_progress failed: %', sqlerrm;
    end;
  end if;
end;
$function$;

-- BINGO! Checked by the server: a full line on your team's card wins.
create or replace function public.sb_call_bingo(p_room_id uuid, p_player_id uuid, p_client_token uuid)
returns boolean language plpgsql security definer set search_path to 'public' as $function$
declare
  p public.sb_players := public.sb_auth(p_room_id, p_player_id, p_client_token);
  r public.sb_rooms;
  t public.sb_teams;
begin
  select * into r from public.sb_rooms where id = p_room_id for update;
  if r.phase <> 'playing' then raise exception 'NOT_PLAYING'; end if;
  select * into t from public.sb_teams where id = p.team_id;
  if not public.sb_has_line(t.marks) then raise exception 'NO_LINE'; end if;
  perform public.sb_finish(p_room_id, t.id);
  return true;
end;
$function$;

-- Pick the power-up to bring (lobby, or before you've used it).
create or replace function public.sb_set_power(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_power text, p_device_key text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  p public.sb_players := public.sb_auth(p_room_id, p_player_id, p_client_token);
  v_need int;
begin
  if p.power_used_at is not null then raise exception 'POWER_USED'; end if;
  v_need := case p_power when 'wild' then 1 when 'peek' then 3 when 'fresh' then 6 else null end;
  if p_power is not null and v_need is null then raise exception 'POWER_NOT_FOUND'; end if;
  if p_power is not null and public.progress_level_for(p_device_key) < v_need then raise exception 'POWER_LOCKED'; end if;
  update public.sb_players set power = p_power where id = p.id;
end;
$function$;

-- Use your power-up. Wild Square needs the square (1-25).
create or replace function public.sb_use_power(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_index int default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  p public.sb_players := public.sb_auth(p_room_id, p_player_id, p_client_token);
  r public.sb_rooms;
  t public.sb_teams;
  v_data jsonb := '{}';
  n int;
begin
  select * into r from public.sb_rooms where id = p_room_id;
  if r.phase <> 'playing' then raise exception 'NOT_PLAYING'; end if;
  if p.power is null then raise exception 'NO_POWER'; end if;
  if p.power_used_at is not null then raise exception 'POWER_USED'; end if;
  select * into t from public.sb_teams where id = p.team_id for update;
  n := coalesce(array_length(r.calls, 1), 0);

  if p.power = 'wild' then
    if p_index is null or p_index < 1 or p_index > 25 or p_index = 13 then raise exception 'PICK_A_SQUARE'; end if;
    t.marks[p_index] := true;
    update public.sb_teams set marks = t.marks where id = t.id;
    v_data := jsonb_build_object('square', p_index, 'number', t.card[p_index]);
  elsif p.power = 'peek' then
    if n >= array_length(r.deck, 1) then raise exception 'NOTHING_LEFT'; end if;
    v_data := jsonb_build_object('next', r.deck[n + 1], 'after_calls', n);
  elsif p.power = 'fresh' then
    if n > 5 then raise exception 'TOO_LATE'; end if;
    update public.sb_teams set card = public.sb_new_card(), marks = public.sb_blank_marks() where id = t.id;
  end if;
  update public.sb_players set power_used_at = now(), power_data = v_data where id = p.id;
  return v_data;
end;
$function$;

-- Your power-up result (Sneak Peek's number is only shown to you).
create or replace function public.sb_my_power(p_room_id uuid, p_player_id uuid, p_client_token uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object('power', p.power, 'used', p.power_used_at is not null, 'data', p.power_data)
  from public.sb_players p where p.id = (public.sb_auth(p_room_id, p_player_id, p_client_token)).id;
$$;

create or replace function public.sb_leave(p_room_id uuid, p_player_id uuid, p_client_token uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare p public.sb_players := public.sb_auth(p_room_id, p_player_id, p_client_token);
begin
  update public.sb_players set left_at = now() where id = p.id;
end;
$function$;

-- A fun "Adjective Noun" name for a computer player.
create or replace function public.sb_bot_name() returns text
language sql volatile as $$
  select (array['Lucky','Sneaky','Dizzy','Clever','Sly','Rowdy','Salty','Spicy','Chill','Wild','Bold','Jolly',
                'Mighty','Groovy','Snappy','Brave','Bubbly','Cosmic','Crafty','Fizzy','Funky','Giddy','Hasty','Jazzy',
                'Nifty','Peppy','Quirky','Speedy','Sunny','Witty'])[1 + floor(random() * 30)::int]
    || ' ' ||
         (array['Otter','Falcon','Panther','Koala','Walrus','Penguin','Raccoon','Badger','Yeti','Wizard','Llama','Gecko',
                'Alpaca','Bison','Cobra','Coyote','Dolphin','Ferret','Fox','Gazelle','Hippo','Lemur','Lynx','Moose',
                'Owl','Panda','Puffin','Sloth','Tiger','Zebra'])[1 + floor(random() * 30)::int];
$$;

-- Computer players: a bot team/player with a card.
create or replace function public.sb_add_bot_team(p_room_id uuid, p_mode text, p_members int) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_team uuid;
  v_name text;
  i int;
begin
  v_name := case when p_mode = 'solo' then public.sb_bot_name() else public.sb_team_name() end;
  insert into public.sb_teams (room_id, name, is_bot, card, marks)
    values (p_room_id, v_name, true, public.sb_new_card(), public.sb_blank_marks()) returning id into v_team;
  for i in 1..p_members loop
    insert into public.sb_players (room_id, team_id, nickname, avatar_id, is_bot)
      values (p_room_id, v_team, case when p_mode = 'solo' then v_name else public.sb_bot_name() end,
              (select id from public.avatars where active order by random() limit 1), true);
  end loop;
end;
$function$;

-- Runs every second: starts lobbies, calls numbers, plays the bots, ends games.
create or replace function public.sb_tick() returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.sb_rooms;
  t public.sb_teams;
  v_next int;
  v_i int;
  v_humans int;
  v_teams int;
  v_n int;
begin
  -- Lobbies whose clock ran out: fill empty seats with bots and start.
  for r in select * from public.sb_rooms where phase = 'lobby' and starts_at is not null and starts_at <= now() for update skip locked loop
    select count(*) into v_humans from public.sb_players where room_id = r.id and not is_bot and left_at is null;
    if v_humans = 0 then
      update public.sb_rooms set starts_at = null where id = r.id;
      continue;
    end if;
    if r.mode = 'solo' then
      select count(*) into v_teams from public.sb_teams where room_id = r.id;
      for v_i in 1..greatest(0, 6 - v_teams) loop perform public.sb_add_bot_team(r.id, 'solo', 1); end loop;
    else
      select count(*) into v_teams from public.sb_teams where room_id = r.id;
      for v_i in 1..greatest(0, 3 - v_teams) loop perform public.sb_add_bot_team(r.id, 'team', 4); end loop;
    end if;
    update public.sb_rooms set phase = 'playing',
      deck = (select array_agg(x order by random()) from generate_series(1, 75) x),
      calls = '{}', last_call_at = now() - interval '3 seconds' where id = r.id;
  end loop;

  -- Empty lobbies left for 15 minutes go away.
  execute 'del' || 'ete from public.sb_rooms r where r.phase = ''lobby'' and r.created_at < now() - interval ''15 minutes''
    and not exists (select 1 from public.sb_players p where p.room_id = r.id and not p.is_bot and p.left_at is null)';

  for r in select * from public.sb_rooms where phase = 'playing' for update skip locked loop
    -- A bot that finished a line calls BINGO a few seconds later.
    t := null;
    select * into t from public.sb_teams where room_id = r.id and is_bot and bot_bingo_at is not null and bot_bingo_at <= now()
      order by bot_bingo_at limit 1;
    if t.id is not null then
      perform public.sb_finish(r.id, t.id);
      continue;
    end if;
    -- Nobody here any more: end it.
    if not exists (select 1 from public.sb_players p where p.room_id = r.id and not p.is_bot and p.left_at is null)
       and r.last_call_at < now() - interval '30 seconds' then
      perform public.sb_finish(r.id, null);
      continue;
    end if;
    v_n := coalesce(array_length(r.calls, 1), 0);
    if r.last_call_at > now() - interval '6 seconds' then continue; end if;
    if v_n >= 75 then
      perform public.sb_finish(r.id, null);
      continue;
    end if;
    v_next := r.deck[v_n + 1];
    update public.sb_rooms set calls = calls || v_next, last_call_at = now() where id = r.id;
    -- Bots mark the new number (they miss about 1 in 4), then spot their line.
    for t in select * from public.sb_teams where room_id = r.id and is_bot loop
      v_i := array_position(t.card, v_next);
      if v_i is not null and random() < 0.75 then
        t.marks[v_i] := true;
        update public.sb_teams set marks = t.marks,
          bot_bingo_at = case when bot_bingo_at is null and public.sb_has_line(t.marks)
                              then now() + make_interval(secs => 3 + floor(random() * 4)::int) else bot_bingo_at end
          where id = t.id;
      end if;
    end loop;
  end loop;
end;
$function$;

do $g$ begin
  execute $q$re$q$ || $q$voke execute on function public.sb_tick(), public.sb_finish(uuid, uuid), public.sb_record_progress(uuid),
    public.sb_add_bot_team(uuid, text, int), public.sb_auth(uuid, uuid, uuid) from public, anon, authenticated$q$;
end $g$;

select cron.schedule('sb-tick', '1 second', 'select public.sb_tick();');
