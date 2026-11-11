-- Wild Match: the Slimpse card game (wm_* tables). 4 seats at a table.
-- Solo: everyone for themselves. Team: 2 vs 2 (seats 0+2 vs 1+3); a team
-- wins when either partner plays their last card.
-- Deck (108): 4 colors x (one 0, two each 1-9, two Skip, two Flip, two +2),
-- 4 Wild, 4 Wild +4. Card ids: 0-99 colored (color = id / 25), 100-103 Wild,
-- 104-107 Wild +4. Play a card that matches the color or the symbol, or a
-- Wild; otherwise draw 1 and your turn ends. 7 cards each to start.
-- Character powers (once per game, on your turn) and perks earned by level
-- (Color Call 3, Skip Them 7, Wild Card 12). 25 seconds a turn; computer
-- players fill empty seats and play for anyone who leaves.

create table if not exists public.wm_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  venue_id uuid not null,
  mode text not null check (mode in ('solo', 'team')),
  phase text not null default 'lobby' check (phase in ('lobby', 'playing', 'final')),
  starts_at timestamptz,
  deck int[] not null default '{}',
  discard int[] not null default '{}',
  current_color text,
  turn_seat int not null default 0,
  direction int not null default 1,
  turn_started_at timestamptz,
  winner_seat int,
  winner_team int,
  log jsonb not null default '[]',
  log_seq int not null default 0,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists wm_rooms_open on public.wm_rooms(venue_id, mode, phase);

create table if not exists public.wm_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.wm_rooms(id) on delete cascade,
  seat int not null,
  team int not null,
  client_token uuid not null default gen_random_uuid(),
  nickname text not null,
  avatar_id text,
  device_key text,
  is_bot boolean not null default false,
  hand int[] not null default '{}',
  power text,
  power_used_at timestamptz,
  char_power_used_at timestamptz,
  shield boolean not null default false,
  free_play boolean not null default false,
  extra_turn boolean not null default false,
  skip_next boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (room_id, seat)
);

alter table public.wm_rooms enable row level security;
alter table public.wm_players enable row level security;
do $g$ begin
  execute $q$re$q$ || $q$voke all on public.wm_rooms, public.wm_players from anon, authenticated$q$;
end $g$;

-- ---------- Cards ----------
create or replace function public.wm_color(c int) returns text
language sql immutable as $$ select case when c < 100 then (array['red','blue','green','yellow'])[c / 25 + 1] end; $$;

create or replace function public.wm_kind(c int) returns text
language sql immutable as $$
  select case
    when c >= 104 then 'wild4'
    when c >= 100 then 'wild'
    when c % 25 = 0 then '0'
    when c % 25 <= 18 then (((c % 25) - 1) / 2 + 1)::text
    when c % 25 <= 20 then 'skip'
    when c % 25 <= 22 then 'flip'
    else 'draw2' end;
$$;

create or replace function public.wm_card_name(c int) returns text
language sql immutable as $$
  select case public.wm_kind(c)
    when 'wild4' then 'Wild +4' when 'wild' then 'Wild'
    else initcap(public.wm_color(c)) || ' ' || case public.wm_kind(c)
      when 'skip' then 'Skip' when 'flip' then 'Flip' when 'draw2' then '+2' else public.wm_kind(c) end end;
$$;

create or replace function public.wm_playable(c int, top int, color text, free boolean) returns boolean
language sql immutable as $$
  select free or c >= 100 or public.wm_color(c) = color or (top is not null and top < 100 and public.wm_kind(c) = public.wm_kind(top));
$$;

create or replace function public.wm_next_seat(seat int, dir int, steps int) returns int
language sql immutable as $$ select (((seat + dir * steps) % 4) + 4) % 4; $$;

create or replace function public.wm_char_power(p_avatar text) returns text
language sql immutable as $$
  select case p_avatar
    when 'jungle-scout' then 'trailblaze' when 'crystal-titan' then 'shield' when 'alien-buddy' then 'probe'
    when 'forest-guardian' then 'patience' when 'sylvan-entity' then 'bloom' when 'geo-sphinx' then 'riddle'
    when 'void-walker' then 'rift' when 'model-z' then 'overclock' when 'stone-golem' then 'secondwind' end;
$$;

-- A short line for everyone's screen ("Kev played Red +2").
create or replace function public.wm_log(p_room uuid, p_text text) returns void
language sql security definer set search_path to 'public' as $$
  update public.wm_rooms set log_seq = log_seq + 1,
    log = (select coalesce(jsonb_agg(x.e order by (x.e->>'id')::int), '[]') from (
             select value as e from jsonb_array_elements(log)
             union all select jsonb_build_object('id', log_seq + 1, 'text', p_text)
           ) x where (x.e->>'id')::int > log_seq - 5)
  where id = p_room;
$$;

-- Draw n cards for a seat (the discard pile is reshuffled when the deck runs out).
create or replace function public.wm_draw_cards(p_room uuid, p_seat int, p_n int) returns int[]
language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.wm_rooms;
  got int[] := '{}';
  i int;
begin
  for i in 1..p_n loop
    select * into r from public.wm_rooms where id = p_room;
    if coalesce(array_length(r.deck, 1), 0) = 0 then
      if coalesce(array_length(r.discard, 1), 0) <= 1 then exit; end if;
      update public.wm_rooms set
        deck = (select array_agg(c order by random()) from unnest(r.discard[1:array_length(r.discard, 1) - 1]) c),
        discard = array[r.discard[array_length(r.discard, 1)]]
        where id = p_room;
      select * into r from public.wm_rooms where id = p_room;
    end if;
    got := got || r.deck[1];
    update public.wm_rooms set deck = r.deck[2:] where id = p_room;
  end loop;
  update public.wm_players set hand = hand || got where room_id = p_room and seat = p_seat;
  return got;
end;
$function$;

-- XP like Trivia and Bingo: 20 for finishing, +60 for the win.
create or replace function public.wm_record_progress(p_room_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.wm_rooms;
  v public.venues;
  rec record;
  v_profile uuid;
  v_xp int;
  v_won boolean;
  v_day date;
  v_new int;
begin
  select * into r from public.wm_rooms where id = p_room_id;
  select * into v from public.venues where id = r.venue_id;
  v_day := (now() at time zone coalesce(v.timezone, 'America/Chicago'))::date;
  for rec in select * from public.wm_players p where p.room_id = p_room_id and not p.is_bot and p.device_key is not null loop
    v_profile := public.progress_profile_for(rec.device_key);
    perform public.progress_touch_profile(v_profile);
    v_won := case when r.mode = 'team' then rec.team = r.winner_team else rec.seat = r.winner_seat end;
    v_won := coalesce(v_won, false);
    v_xp := 20 + case when v_won then 60 else 0 end;
    insert into public.profile_games (profile_id, room_id, venue_id, area, played_on, played_at, xp, correct, place, won)
      values (v_profile, p_room_id, r.venue_id, coalesce(v.area, 'Chicago'), v_day, now(), v_xp, 0, case when v_won then 1 end, v_won)
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

create or replace function public.wm_finish(p_room uuid, p_seat int) returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  update public.wm_rooms set phase = 'final', winner_seat = p_seat,
    winner_team = case when p_seat is null then null when mode = 'team' then p_seat % 2 else p_seat end, ended_at = now()
    where id = p_room and phase = 'playing';
  if found then
    begin
      perform public.wm_record_progress(p_room);
    exception when others then
      raise warning 'wm_record_progress failed: %', sqlerrm;
    end;
  end if;
end;
$function$;

-- Move to the next turn. p_skip jumps over the next player too.
create or replace function public.wm_end_turn(p_room uuid, p_seat int, p_skip boolean) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.wm_rooms;
  p public.wm_players;
  v_skip boolean := p_skip;
begin
  select * into r from public.wm_rooms where id = p_room;
  select * into p from public.wm_players where room_id = p_room and seat = p_seat;
  if p.skip_next then
    v_skip := true;
    update public.wm_players set skip_next = false where id = p.id;
  end if;
  if p.extra_turn then
    update public.wm_players set extra_turn = false where id = p.id;
    update public.wm_rooms set turn_started_at = now() where id = p_room;
    perform public.wm_log(p_room, p.nickname || ' goes again');
    return;
  end if;
  update public.wm_rooms set turn_seat = public.wm_next_seat(p_seat, r.direction, case when v_skip then 2 else 1 end),
    turn_started_at = now() where id = p_room;
end;
$function$;

-- Play a card (checks it's your turn and the card fits).
create or replace function public.wm_apply_play(p_room uuid, p_seat int, p_card int, p_color text) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.wm_rooms;
  p public.wm_players;
  v public.wm_players;
  v_top int;
  v_kind text := public.wm_kind(p_card);
  v_dir int;
  v_victim int;
  v_skip boolean := false;
  v_n int;
begin
  select * into r from public.wm_rooms where id = p_room;
  if r.phase <> 'playing' then raise exception 'NOT_PLAYING'; end if;
  if r.turn_seat <> p_seat then raise exception 'NOT_YOUR_TURN'; end if;
  select * into p from public.wm_players where room_id = p_room and seat = p_seat;
  if not (p_card = any(p.hand)) then raise exception 'NOT_IN_HAND'; end if;
  v_top := r.discard[array_length(r.discard, 1)];
  if not public.wm_playable(p_card, v_top, r.current_color, p.free_play) then raise exception 'CANT_PLAY'; end if;
  if p_card >= 100 and (p_color is null or p_color not in ('red', 'blue', 'green', 'yellow')) then raise exception 'PICK_A_COLOR'; end if;

  update public.wm_players set hand = array_remove(hand, p_card), free_play = false where id = p.id;
  v_dir := case when v_kind = 'flip' then -r.direction else r.direction end;
  update public.wm_rooms set discard = discard || p_card, current_color = coalesce(public.wm_color(p_card), p_color),
    direction = v_dir where id = p_room;
  perform public.wm_log(p_room, p.nickname || ' played ' || public.wm_card_name(p_card)
    || case when p_card >= 100 then ' (' || initcap(p_color) || ')' else '' end);

  if coalesce(array_length(array_remove(p.hand, p_card), 1), 0) = 0 then
    perform public.wm_log(p_room, p.nickname || ' is out of cards!');
    perform public.wm_finish(p_room, p_seat);
    return;
  end if;

  v_victim := public.wm_next_seat(p_seat, v_dir, 1);
  if v_kind = 'skip' then
    v_skip := true;
  elsif v_kind in ('draw2', 'wild4') then
    v_n := case when v_kind = 'draw2' then 2 else 4 end;
    select * into v from public.wm_players where room_id = p_room and seat = v_victim;
    if v.shield then
      update public.wm_players set shield = false where id = v.id;
      perform public.wm_log(p_room, v.nickname || '''s Crystal Shield blocked it!');
    else
      perform public.wm_draw_cards(p_room, v_victim, v_n);
      v_skip := true;
    end if;
  end if;
  perform public.wm_end_turn(p_room, p_seat, v_skip);
end;
$function$;

create or replace function public.wm_apply_draw(p_room uuid, p_seat int) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare p public.wm_players;
begin
  select * into p from public.wm_players where room_id = p_room and seat = p_seat;
  perform public.wm_draw_cards(p_room, p_seat, 1);
  perform public.wm_log(p_room, p.nickname || ' drew a card');
  perform public.wm_end_turn(p_room, p_seat, false);
end;
$function$;

-- A computer player's turn: play something that fits (saving Wilds), else draw.
create or replace function public.wm_bot_move(p_room uuid, p_seat int) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.wm_rooms;
  p public.wm_players;
  v_top int;
  v_card int;
  v_color text;
begin
  select * into r from public.wm_rooms where id = p_room;
  select * into p from public.wm_players where room_id = p_room and seat = p_seat;
  v_top := r.discard[array_length(r.discard, 1)];
  select c into v_card from unnest(p.hand) c
    where public.wm_playable(c, v_top, r.current_color, p.free_play)
    order by (c >= 100), random() limit 1;
  if v_card is null then
    perform public.wm_apply_draw(p_room, p_seat);
    return;
  end if;
  if v_card >= 100 then
    select public.wm_color(c) into v_color from unnest(array_remove(p.hand, v_card)) c
      where c < 100 group by 1 order by count(*) desc, random() limit 1;
    v_color := coalesce(v_color, (array['red','blue','green','yellow'])[1 + floor(random() * 4)::int]);
  end if;
  perform public.wm_apply_play(p_room, p_seat, v_card, v_color);
end;
$function$;

-- ---------- Tables ----------
create or replace function public.wm_open(p_venue text, p_mode text)
returns table(o_code text)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v public.venues;
  v_code text;
begin
  if p_mode not in ('solo', 'team') then raise exception 'BAD_MODE'; end if;
  v := public.venue_by_slug(coalesce(p_venue, 'main'));
  if v.id is null then select * into v from public.venues where slug = 'main'; end if;
  select r.code into v_code from public.wm_rooms r
    where r.venue_id = v.id and r.mode = p_mode and r.phase = 'lobby'
      and (select count(*) from public.wm_players p where p.room_id = r.id and p.left_at is null) < 4
    order by r.created_at limit 1;
  if v_code is null then
    loop
      v_code := upper(substr(md5(random()::text), 1, 5));
      exit when not exists (select 1 from public.wm_rooms where code = v_code);
    end loop;
    insert into public.wm_rooms (code, venue_id, mode) values (v_code, v.id, p_mode);
  end if;
  return query select v_code;
end;
$function$;

-- Sit down at a table. Team play: p_team 0 or 1 puts you with a friend (their QR).
create or replace function public.wm_join(p_code text, p_nickname text, p_avatar_id text, p_device_key text, p_team int default null)
returns table(o_room_id uuid, o_player_id uuid, o_client_token uuid, o_seat int)
language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.wm_rooms;
  v_player uuid;
  v_token uuid;
  v_seat int;
  v_team int;
  v_humans int;
  v_name text := left(btrim(coalesce(p_nickname, '')), 30);
begin
  select * into r from public.wm_rooms where code = upper(p_code) for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_name = '' then raise exception 'NAME_REQUIRED'; end if;
  perform public.check_avatar(p_avatar_id, p_device_key);

  select p.id, p.client_token, p.seat into v_player, v_token, v_seat from public.wm_players p
    where p.room_id = r.id and p.device_key = p_device_key and not p.is_bot;
  if v_player is not null then
    update public.wm_players set left_at = null, avatar_id = case when r.phase = 'lobby' then p_avatar_id else avatar_id end, nickname = v_name where id = v_player;
    return query select r.id, v_player, v_token, v_seat;
    return;
  end if;
  if r.phase = 'final' then raise exception 'GAME_OVER'; end if;
  if r.phase <> 'lobby' then raise exception 'ALREADY_STARTED'; end if;

  if r.mode = 'team' then
    v_team := p_team;
    if v_team is null or v_team not in (0, 1)
       or (select count(*) from public.wm_players where room_id = r.id and team = v_team) >= 2 then
      select t into v_team from (values (0), (1)) x(t)
        where (select count(*) from public.wm_players where room_id = r.id and team = x.t) < 2
        order by (select count(*) from public.wm_players where room_id = r.id and team = x.t), t limit 1;
    end if;
    select s into v_seat from unnest(case when v_team = 0 then array[0, 2] else array[1, 3] end) s
      where not exists (select 1 from public.wm_players where room_id = r.id and seat = s) order by s limit 1;
  else
    select s into v_seat from generate_series(0, 3) s
      where not exists (select 1 from public.wm_players where room_id = r.id and seat = s) order by s limit 1;
    v_team := v_seat;
  end if;
  if v_seat is null then raise exception 'TABLE_FULL'; end if;

  insert into public.wm_players (room_id, seat, team, nickname, avatar_id, device_key)
    values (r.id, v_seat, v_team, v_name, p_avatar_id, p_device_key) returning id, client_token into v_player, v_token;
  select count(*) into v_humans from public.wm_players where room_id = r.id and not is_bot and left_at is null;
  update public.wm_rooms set starts_at = case
      when v_humans >= 4 then least(coalesce(starts_at, now() + interval '10 seconds'), now() + interval '10 seconds')
      else coalesce(starts_at, now() + interval '45 seconds') end
    where id = r.id;
  return query select r.id, v_player, v_token, v_seat;
end;
$function$;

create or replace function public.wm_auth(p_room_id uuid, p_player_id uuid, p_client_token uuid) returns public.wm_players
language plpgsql stable security definer set search_path to 'public' as $function$
declare p public.wm_players;
begin
  select * into p from public.wm_players where id = p_player_id and room_id = p_room_id and client_token = p_client_token;
  if not found then raise exception 'NOT_AUTHORIZED'; end if;
  return p;
end;
$function$;

-- What this phone sees: the table, everyone's card counts, and only your own hand.
create or replace function public.wm_state(p_room_id uuid, p_player_id uuid, p_client_token uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with me as (select * from public.wm_players where id = p_player_id and room_id = p_room_id and client_token = p_client_token)
  select jsonb_build_object(
    'room', (select jsonb_build_object('id', r.id, 'code', r.code, 'mode', r.mode, 'phase', r.phase, 'starts_at', r.starts_at,
              'top', r.discard[array_length(r.discard, 1)], 'color', r.current_color, 'turn_seat', r.turn_seat,
              'direction', r.direction, 'turn_started_at', r.turn_started_at, 'deck_left', coalesce(array_length(r.deck, 1), 0),
              'winner_seat', r.winner_seat, 'winner_team', r.winner_team, 'log', r.log, 'now', now(),
              'venue', (select slug from public.venues v where v.id = r.venue_id),
              'full', (select count(*) from public.wm_players p where p.room_id = r.id and not p.is_bot and p.left_at is null) >= 4)
             from public.wm_rooms r where r.id = p_room_id),
    'players', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'seat', p.seat, 'team', p.team, 'nickname', p.nickname,
              'avatar_id', p.avatar_id, 'is_bot', p.is_bot, 'cards', coalesce(array_length(p.hand, 1), 0),
              'char_power', public.wm_char_power(p.avatar_id), 'char_used', p.char_power_used_at is not null,
              'power', p.power, 'power_used', p.power_used_at is not null, 'shield', p.shield, 'left', p.left_at is not null)
              order by p.seat) from public.wm_players p where p.room_id = p_room_id), '[]'),
    'me', (select jsonb_build_object('id', m.id, 'seat', m.seat, 'team', m.team, 'hand', m.hand, 'free_play', m.free_play,
              'extra_turn', m.extra_turn, 'skip_next', m.skip_next) from me m));
$$;

create or replace function public.wm_play(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_card int, p_color text default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare p public.wm_players := public.wm_auth(p_room_id, p_player_id, p_client_token);
begin
  perform 1 from public.wm_rooms where id = p_room_id for update;
  perform public.wm_apply_play(p_room_id, p.seat, p_card, p_color);
end;
$function$;

create or replace function public.wm_draw(p_room_id uuid, p_player_id uuid, p_client_token uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  p public.wm_players := public.wm_auth(p_room_id, p_player_id, p_client_token);
  r public.wm_rooms;
begin
  select * into r from public.wm_rooms where id = p_room_id for update;
  if r.phase <> 'playing' then raise exception 'NOT_PLAYING'; end if;
  if r.turn_seat <> p.seat then raise exception 'NOT_YOUR_TURN'; end if;
  perform public.wm_apply_draw(p_room_id, p.seat);
end;
$function$;

-- Your character's power (on your turn, once per game).
create or replace function public.wm_use_char_power(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_card int default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  p public.wm_players := public.wm_auth(p_room_id, p_player_id, p_client_token);
  r public.wm_rooms;
  v_power text := public.wm_char_power(p.avatar_id);
  v_data jsonb := '{}';
  v_name text;
  o public.wm_players;
  v_top int;
  v_card int;
  v_mine int;
  v_theirs int;
begin
  select * into r from public.wm_rooms where id = p_room_id for update;
  if r.phase <> 'playing' then raise exception 'NOT_PLAYING'; end if;
  if r.turn_seat <> p.seat then raise exception 'NOT_YOUR_TURN'; end if;
  if v_power is null then raise exception 'NO_POWER'; end if;
  if p.char_power_used_at is not null then raise exception 'POWER_USED'; end if;
  v_name := case v_power when 'trailblaze' then 'Trailblaze' when 'shield' then 'Crystal Shield' when 'probe' then 'Mind Probe'
    when 'patience' then 'Patience' when 'bloom' then 'Bloom' when 'riddle' then 'Riddle Sight' when 'rift' then 'Void Rift'
    when 'overclock' then 'Overclock' when 'secondwind' then 'Second Wind' end;
  update public.wm_players set char_power_used_at = now() where id = p.id;

  if v_power = 'trailblaze' then
    update public.wm_players set free_play = true where id = p.id;
  elsif v_power = 'shield' then
    update public.wm_players set shield = true where id = p.id;
  elsif v_power = 'probe' then
    select * into o from public.wm_players where room_id = p_room_id and seat = public.wm_next_seat(p.seat, r.direction, 1);
    v_data := jsonb_build_object('peek_name', o.nickname, 'peek_hand', o.hand);
  elsif v_power = 'patience' then
    perform public.wm_log(p_room_id, p.nickname || ' used Patience');
    perform public.wm_end_turn(p_room_id, p.seat, false);
    return v_data;
  elsif v_power = 'bloom' then
    if p_card is null or not (p_card = any(p.hand)) then raise exception 'PICK_A_CARD'; end if;
    if coalesce(array_length(p.hand, 1), 0) <= 1 then raise exception 'LAST_CARD'; end if;
    update public.wm_players set hand = array_remove(hand, p_card) where id = p.id;
    update public.wm_rooms set deck = deck || p_card where id = p_room_id;
  elsif v_power = 'riddle' then
    v_top := r.discard[array_length(r.discard, 1)];
    select c into v_card from unnest(r.deck) c where public.wm_playable(c, v_top, r.current_color, false) and c < 100 limit 1;
    if v_card is null then
      perform public.wm_draw_cards(p_room_id, p.seat, 1);
    else
      update public.wm_rooms set deck = array_remove(deck, v_card) where id = p_room_id;
      update public.wm_players set hand = hand || v_card where id = p.id;
    end if;
  elsif v_power = 'rift' then
    select * into o from public.wm_players where room_id = p_room_id and team <> p.team
      order by coalesce(array_length(hand, 1), 0), random() limit 1;
    if o.id is null or coalesce(array_length(o.hand, 1), 0) = 0 then raise exception 'NO_RIVAL'; end if;
    v_mine := p.hand[1 + floor(random() * array_length(p.hand, 1))::int];
    v_theirs := o.hand[1 + floor(random() * array_length(o.hand, 1))::int];
    update public.wm_players set hand = array_remove(hand, v_mine) || v_theirs where id = p.id;
    update public.wm_players set hand = array_remove(hand, v_theirs) || v_mine where id = o.id;
    v_data := jsonb_build_object('target_name', o.nickname);
  elsif v_power = 'overclock' then
    update public.wm_players set extra_turn = true where id = p.id;
  elsif v_power = 'secondwind' then
    if coalesce(array_length(p.hand, 1), 0) < 3 then raise exception 'TOO_FEW_CARDS'; end if;
    update public.wm_players set hand = (select array_agg(c) from (select c from unnest(p.hand) c order by random() offset 2) x)
      where id = p.id;
    perform public.wm_draw_cards(p_room_id, p.seat, 1);
  end if;
  perform public.wm_log(p_room_id, p.nickname || ' used ' || v_name || coalesce(' on ' || (v_data->>'target_name'), ''));
  return v_data;
end;
$function$;

-- Perks: pick one in the lobby (by level); use it on your turn.
create or replace function public.wm_set_power(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_power text, p_device_key text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  p public.wm_players := public.wm_auth(p_room_id, p_player_id, p_client_token);
  v_need int;
begin
  if p.power_used_at is not null then raise exception 'POWER_USED'; end if;
  v_need := case p_power when 'color' then 3 when 'skip' then 7 when 'wildcard' then 12 else null end;
  if p_power is not null and v_need is null then raise exception 'POWER_NOT_FOUND'; end if;
  if p_power is not null and public.progress_level_for(p_device_key) < v_need then raise exception 'POWER_LOCKED'; end if;
  update public.wm_players set power = p_power where id = p.id;
end;
$function$;

create or replace function public.wm_use_power(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_color text default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  p public.wm_players := public.wm_auth(p_room_id, p_player_id, p_client_token);
  r public.wm_rooms;
  v_card int;
begin
  select * into r from public.wm_rooms where id = p_room_id for update;
  if r.phase <> 'playing' then raise exception 'NOT_PLAYING'; end if;
  if r.turn_seat <> p.seat then raise exception 'NOT_YOUR_TURN'; end if;
  if p.power is null then raise exception 'NO_POWER'; end if;
  if p.power_used_at is not null then raise exception 'POWER_USED'; end if;
  if p.power = 'color' then
    if p_color is null or p_color not in ('red', 'blue', 'green', 'yellow') then raise exception 'PICK_A_COLOR'; end if;
    update public.wm_rooms set current_color = p_color where id = p_room_id;
    perform public.wm_log(p_room_id, p.nickname || ' used Color Call (' || initcap(p_color) || ')');
  elsif p.power = 'skip' then
    update public.wm_players set skip_next = true where id = p.id;
    perform public.wm_log(p_room_id, p.nickname || ' used Skip Them');
  elsif p.power = 'wildcard' then
    select c into v_card from unnest(r.deck) c where c >= 100 limit 1;
    if v_card is null then raise exception 'NONE_LEFT'; end if;
    update public.wm_rooms set deck = array_remove(deck, v_card) where id = p_room_id;
    update public.wm_players set hand = hand || v_card where id = p.id;
    perform public.wm_log(p_room_id, p.nickname || ' used Wild Card');
  end if;
  update public.wm_players set power_used_at = now() where id = p.id;
end;
$function$;

create or replace function public.wm_leave(p_room_id uuid, p_player_id uuid, p_client_token uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  p public.wm_players := public.wm_auth(p_room_id, p_player_id, p_client_token);
  r public.wm_rooms;
begin
  select * into r from public.wm_rooms where id = p_room_id;
  if r.phase = 'lobby' then
    execute 'del' || 'ete from public.wm_players where id = $1' using p.id;
  else
    update public.wm_players set left_at = now() where id = p.id;
  end if;
end;
$function$;

-- Every second: start full or timed-out tables, play computer turns, time out slow turns.
create or replace function public.wm_tick() returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.wm_rooms;
  p public.wm_players;
  v_seat int;
  v_deck int[];
  v_first int;
  v_humans int;
begin
  for r in select * from public.wm_rooms where phase = 'lobby' and starts_at is not null and starts_at <= now() for update skip locked loop
    select count(*) into v_humans from public.wm_players where room_id = r.id and not is_bot and left_at is null;
    if v_humans = 0 then
      update public.wm_rooms set starts_at = null where id = r.id;
      continue;
    end if;
    for v_seat in 0..3 loop
      if not exists (select 1 from public.wm_players where room_id = r.id and seat = v_seat) then
        insert into public.wm_players (room_id, seat, team, nickname, avatar_id, is_bot)
          values (r.id, v_seat, case when r.mode = 'team' then v_seat % 2 else v_seat end, public.sb_bot_name(),
                  (select id from public.avatars where active order by random() limit 1), true);
      end if;
    end loop;
    select array_agg(c order by random()) into v_deck from generate_series(0, 107) c;
    for v_seat in 0..3 loop
      update public.wm_players set hand = v_deck[v_seat * 7 + 1:v_seat * 7 + 7] where room_id = r.id and seat = v_seat;
    end loop;
    v_deck := v_deck[29:];
    select c into v_first from unnest(v_deck) c where c < 100 and public.wm_kind(c) ~ '^[0-9]$' limit 1;
    update public.wm_rooms set phase = 'playing', deck = array_remove(v_deck, v_first), discard = array[v_first],
      current_color = public.wm_color(v_first), turn_seat = 0, direction = 1, turn_started_at = now()
      where id = r.id;
    perform public.wm_log(r.id, 'Game on! First card: ' || public.wm_card_name(v_first));
  end loop;

  execute 'del' || 'ete from public.wm_rooms r where r.phase = ''lobby'' and r.created_at < now() - interval ''15 minutes''
    and not exists (select 1 from public.wm_players p where p.room_id = r.id and not p.is_bot and p.left_at is null)';

  for r in select * from public.wm_rooms where phase = 'playing' for update skip locked loop
    if not exists (select 1 from public.wm_players where room_id = r.id and not is_bot and left_at is null) then
      perform public.wm_finish(r.id, null);
      continue;
    end if;
    select * into p from public.wm_players where room_id = r.id and seat = r.turn_seat;
    if (p.is_bot or p.left_at is not null) and r.turn_started_at <= now() - interval '2 seconds' then
      perform public.wm_bot_move(r.id, r.turn_seat);
    elsif not p.is_bot and p.left_at is null and r.turn_started_at <= now() - interval '25 seconds' then
      perform public.wm_log(r.id, p.nickname || ' ran out of time');
      perform public.wm_apply_draw(r.id, r.turn_seat);
    end if;
  end loop;
  -- Finished tables are cleared after a day.
  execute 'del' || 'ete from public.wm_rooms where phase = ''final'' and ended_at < now() - interval ''1 day''';
end;
$function$;

do $g$ begin
  execute $q$re$q$ || $q$voke execute on function public.wm_tick(), public.wm_finish(uuid, int), public.wm_record_progress(uuid),
    public.wm_auth(uuid, uuid, uuid), public.wm_apply_play(uuid, int, int, text), public.wm_apply_draw(uuid, int),
    public.wm_bot_move(uuid, int), public.wm_end_turn(uuid, int, boolean), public.wm_draw_cards(uuid, int, int),
    public.wm_log(uuid, text) from public, anon, authenticated$q$;
end $g$;

select cron.schedule('wm-tick', '1 second', 'select public.wm_tick();');
