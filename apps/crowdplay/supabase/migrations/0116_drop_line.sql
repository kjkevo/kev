-- Drop Line: the Slimpse 4-in-a-row game (dl_* tables). A 7 x 6 board; drop
-- a piece into a column and it falls to the lowest empty spot. Four of your
-- color in a row (across, up, or diagonal) wins.
-- Solo: 2 seats, you vs one other (a computer player if nobody else joins).
-- Team: 4 seats, 2 vs 2 (seats 0+2 are Gold, 1+3 are Blue), taking turns.
-- Board: int[42], index = row * 7 + col + 1 (row 0 is the bottom);
-- 0 empty, 1 Gold, 2 Blue, 3 a block (Bloom). 20 seconds a turn.
-- Character powers (once per game, on your turn) and perks by level
-- (Extra Time 3, Hint 7, Block Column 12).

create table if not exists public.dl_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  venue_id uuid not null,
  mode text not null check (mode in ('solo', 'team')),
  phase text not null default 'lobby' check (phase in ('lobby', 'playing', 'final')),
  starts_at timestamptz,
  board int[] not null default array_fill(0, array[42]),
  turn_seat int not null default 0,
  turn_started_at timestamptz,
  turn_limit int not null default 20,
  winner_color int,
  blocked_col int,
  blocked_color int,
  protected jsonb not null default '{}',
  last_drop jsonb not null default '{}',
  log jsonb not null default '[]',
  log_seq int not null default 0,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists dl_rooms_open on public.dl_rooms(venue_id, mode, phase);

create table if not exists public.dl_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.dl_rooms(id) on delete cascade,
  seat int not null,
  color int not null,
  client_token uuid not null default gen_random_uuid(),
  nickname text not null,
  avatar_id text,
  device_key text,
  is_bot boolean not null default false,
  power text,
  power_used_at timestamptz,
  char_power_used_at timestamptz,
  extra_turn boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (room_id, seat)
);

alter table public.dl_rooms enable row level security;
alter table public.dl_players enable row level security;
do $g$ begin
  execute $q$re$q$ || $q$voke all on public.dl_rooms, public.dl_players from anon, authenticated$q$;
end $g$;

create or replace function public.dl_seats(p_mode text) returns int
language sql immutable as $$ select case when p_mode = 'team' then 4 else 2 end; $$;

create or replace function public.dl_char_power(p_avatar text) returns text
language sql immutable as $$
  select case p_avatar
    when 'jungle-scout' then 'trailblaze' when 'crystal-titan' then 'shield' when 'alien-buddy' then 'probe'
    when 'forest-guardian' then 'patience' when 'sylvan-entity' then 'bloom' when 'geo-sphinx' then 'riddle'
    when 'void-walker' then 'rift' when 'model-z' then 'overclock' when 'stone-golem' then 'secondwind' end;
$$;

-- The row a piece dropped in this column lands on (null = column full).
create or replace function public.dl_landing(b int[], c int) returns int
language sql immutable as $$ select min(r) from generate_series(0, 5) r where b[r * 7 + c + 1] = 0; $$;

-- Who has four in a row (1 or 2), or 0.
create or replace function public.dl_winner(b int[]) returns int
language plpgsql immutable as $$
declare r int; c int; v int; d int[]; k int;
begin
  for r in 0..5 loop
    for c in 0..6 loop
      v := b[r * 7 + c + 1];
      if v not in (1, 2) then continue; end if;
      foreach k in array array[1, 2, 3, 4] loop
        d := case k when 1 then array[0, 1] when 2 then array[1, 0] when 3 then array[1, 1] else array[1, -1] end;
        if r + 3 * d[1] between 0 and 5 and c + 3 * d[2] between 0 and 6
           and b[(r + d[1]) * 7 + c + d[2] + 1] = v and b[(r + 2 * d[1]) * 7 + c + 2 * d[2] + 1] = v
           and b[(r + 3 * d[1]) * 7 + c + 3 * d[2] + 1] = v then
          return v;
        end if;
      end loop;
    end loop;
  end loop;
  return 0;
end;
$$;

-- Take one spot out of a column; the pieces above fall down.
create or replace function public.dl_remove(b int[], r int, c int) returns int[]
language plpgsql immutable as $$
declare k int;
begin
  for k in r..4 loop
    b[k * 7 + c + 1] := b[(k + 1) * 7 + c + 1];
  end loop;
  b[5 * 7 + c + 1] := 0;
  return b;
end;
$$;

-- The column that wins right now for this color (null if none).
create or replace function public.dl_winning_col(b int[], p_color int) returns int
language plpgsql immutable as $$
declare c int; r int; t int[];
begin
  for c in select x from unnest(array[3, 2, 4, 1, 5, 0, 6]) x loop
    r := public.dl_landing(b, c);
    if r is null then continue; end if;
    t := b;
    t[r * 7 + c + 1] := p_color;
    if public.dl_winner(t) = p_color then return c; end if;
  end loop;
  return null;
end;
$$;

-- A good column for this color: win if you can, block their win, else near the middle.
create or replace function public.dl_best_col(b int[], p_color int, p_blocked int default null) returns int
language plpgsql volatile as $$
declare c int; r int; t int[];
begin
  c := public.dl_winning_col(b, p_color);
  if c is not null and c is distinct from p_blocked then return c; end if;
  c := public.dl_winning_col(b, 3 - p_color);
  if c is not null and c is distinct from p_blocked then return c; end if;
  -- Avoid giving the other side a win on top of your piece.
  for c in select x from unnest(array[3, 2, 4, 1, 5, 0, 6]) x order by abs(x - 3) + random() * 2.5 loop
    if c is not distinct from p_blocked then continue; end if;
    r := public.dl_landing(b, c);
    if r is null then continue; end if;
    t := b;
    t[r * 7 + c + 1] := p_color;
    if public.dl_winning_col(t, 3 - p_color) is distinct from c then return c; end if;
  end loop;
  select x into c from unnest(array[3, 2, 4, 1, 5, 0, 6]) x where public.dl_landing(b, x) is not null and x is distinct from p_blocked limit 1;
  return c;
end;
$$;

create or replace function public.dl_log(p_room uuid, p_text text) returns void
language sql security definer set search_path to 'public' as $$
  update public.dl_rooms set log_seq = log_seq + 1,
    log = (select coalesce(jsonb_agg(x.e order by (x.e->>'id')::int), '[]') from (
             select value as e from jsonb_array_elements(log)
             union all select jsonb_build_object('id', log_seq + 1, 'text', p_text)
           ) x where (x.e->>'id')::int > log_seq - 5)
  where id = p_room;
$$;

create or replace function public.dl_record_progress(p_room_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.dl_rooms;
  v public.venues;
  rec record;
  v_profile uuid;
  v_xp int;
  v_won boolean;
  v_day date;
  v_new int;
begin
  select * into r from public.dl_rooms where id = p_room_id;
  select * into v from public.venues where id = r.venue_id;
  v_day := (now() at time zone coalesce(v.timezone, 'America/Chicago'))::date;
  for rec in select * from public.dl_players p where p.room_id = p_room_id and not p.is_bot and p.device_key is not null loop
    v_profile := public.progress_profile_for(rec.device_key);
    perform public.progress_touch_profile(v_profile);
    v_won := coalesce(rec.color = r.winner_color, false);
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

create or replace function public.dl_finish(p_room uuid, p_color int) returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  update public.dl_rooms set phase = 'final', winner_color = p_color, ended_at = now() where id = p_room and phase = 'playing';
  if found then
    begin
      perform public.dl_record_progress(p_room);
    exception when others then
      raise warning 'dl_record_progress failed: %', sqlerrm;
    end;
  end if;
end;
$function$;

-- After a board change: a win ends the game, a full board is a tie.
create or replace function public.dl_check_end(p_room uuid) returns boolean
language plpgsql security definer set search_path to 'public' as $function$
declare r public.dl_rooms; w int;
begin
  select * into r from public.dl_rooms where id = p_room;
  w := public.dl_winner(r.board);
  if w > 0 then
    perform public.dl_log(p_room, case w when 1 then 'Gold' else 'Blue' end || ' got 4 in a row!');
    perform public.dl_finish(p_room, w);
    return true;
  end if;
  if not (0 = any(r.board[36:42])) then
    perform public.dl_log(p_room, 'The board is full. It''s a tie!');
    perform public.dl_finish(p_room, null);
    return true;
  end if;
  return false;
end;
$function$;

create or replace function public.dl_next_turn(p_room uuid, p_seat int) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare r public.dl_rooms; p public.dl_players;
begin
  select * into r from public.dl_rooms where id = p_room;
  select * into p from public.dl_players where room_id = p_room and seat = p_seat;
  if p.extra_turn then
    update public.dl_players set extra_turn = false where id = p.id;
    update public.dl_rooms set turn_started_at = now(), turn_limit = 20 where id = p_room;
    perform public.dl_log(p_room, p.nickname || ' goes again');
    return;
  end if;
  update public.dl_rooms set turn_seat = (p_seat + 1) % public.dl_seats(r.mode), turn_started_at = now(), turn_limit = 20
    where id = p_room;
  -- A Block Column lasts for the blocked side's next turn only.
  update public.dl_rooms set blocked_col = null, blocked_color = null
    where id = p_room and blocked_color is not null and blocked_color = p.color;
end;
$function$;

-- Drop a piece (checks turn, column, and Block Column).
create or replace function public.dl_apply_drop(p_room uuid, p_seat int, p_col int) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.dl_rooms;
  p public.dl_players;
  v_row int;
begin
  select * into r from public.dl_rooms where id = p_room;
  if r.phase <> 'playing' then raise exception 'NOT_PLAYING'; end if;
  if r.turn_seat <> p_seat then raise exception 'NOT_YOUR_TURN'; end if;
  if p_col < 0 or p_col > 6 then raise exception 'BAD_COLUMN'; end if;
  select * into p from public.dl_players where room_id = p_room and seat = p_seat;
  if r.blocked_col = p_col and r.blocked_color = p.color then raise exception 'BLOCKED'; end if;
  v_row := public.dl_landing(r.board, p_col);
  if v_row is null then raise exception 'COLUMN_FULL'; end if;
  r.board[v_row * 7 + p_col + 1] := p.color;
  update public.dl_rooms set board = r.board,
    last_drop = last_drop || jsonb_build_object(p.color::text, jsonb_build_object('row', v_row, 'col', p_col))
    where id = p_room;
  perform public.dl_log(p_room, p.nickname || ' dropped in column ' || (p_col + 1));
  if public.dl_check_end(p_room) then return; end if;
  perform public.dl_next_turn(p_room, p_seat);
end;
$function$;

-- ---------- Tables ----------
create or replace function public.dl_open(p_venue text, p_mode text)
returns table(o_code text)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v public.venues;
  v_code text;
begin
  if p_mode not in ('solo', 'team') then raise exception 'BAD_MODE'; end if;
  v := public.venue_by_slug(coalesce(p_venue, 'main'));
  if v.id is null then select * into v from public.venues where slug = 'main'; end if;
  select r.code into v_code from public.dl_rooms r
    where r.venue_id = v.id and r.mode = p_mode and r.phase = 'lobby'
      and (select count(*) from public.dl_players p where p.room_id = r.id and p.left_at is null) < public.dl_seats(p_mode)
    order by r.created_at limit 1;
  if v_code is null then
    loop
      v_code := upper(substr(md5(random()::text), 1, 5));
      exit when not exists (select 1 from public.dl_rooms where code = v_code);
    end loop;
    insert into public.dl_rooms (code, venue_id, mode) values (v_code, v.id, p_mode);
  end if;
  return query select v_code;
end;
$function$;

-- Sit down. Team play: p_team 0 (Gold) or 1 (Blue) joins a friend's side.
create or replace function public.dl_join(p_code text, p_nickname text, p_avatar_id text, p_device_key text, p_team int default null)
returns table(o_room_id uuid, o_player_id uuid, o_client_token uuid, o_seat int)
language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.dl_rooms;
  v_player uuid;
  v_token uuid;
  v_seat int;
  v_team int;
  v_humans int;
  v_n int;
  v_name text := left(btrim(coalesce(p_nickname, '')), 30);
begin
  select * into r from public.dl_rooms where code = upper(p_code) for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_name = '' then raise exception 'NAME_REQUIRED'; end if;
  perform public.check_avatar(p_avatar_id, p_device_key);
  v_n := public.dl_seats(r.mode);

  select p.id, p.client_token, p.seat into v_player, v_token, v_seat from public.dl_players p
    where p.room_id = r.id and p.device_key = p_device_key and not p.is_bot;
  if v_player is not null then
    update public.dl_players set left_at = null, avatar_id = case when r.phase = 'lobby' then p_avatar_id else avatar_id end, nickname = v_name where id = v_player;
    return query select r.id, v_player, v_token, v_seat;
    return;
  end if;
  if r.phase = 'final' then raise exception 'GAME_OVER'; end if;
  if r.phase <> 'lobby' then raise exception 'ALREADY_STARTED'; end if;

  if r.mode = 'team' then
    v_team := p_team;
    if v_team is null or v_team not in (0, 1)
       or (select count(*) from public.dl_players where room_id = r.id and color = v_team + 1) >= 2 then
      select t into v_team from (values (0), (1)) x(t)
        where (select count(*) from public.dl_players where room_id = r.id and color = x.t + 1) < 2
        order by (select count(*) from public.dl_players where room_id = r.id and color = x.t + 1), t limit 1;
    end if;
    select s into v_seat from unnest(case when v_team = 0 then array[0, 2] else array[1, 3] end) s
      where not exists (select 1 from public.dl_players where room_id = r.id and seat = s) order by s limit 1;
  else
    select s into v_seat from generate_series(0, 1) s
      where not exists (select 1 from public.dl_players where room_id = r.id and seat = s) order by s limit 1;
  end if;
  if v_seat is null then raise exception 'TABLE_FULL'; end if;

  insert into public.dl_players (room_id, seat, color, nickname, avatar_id, device_key)
    values (r.id, v_seat, v_seat % 2 + 1, v_name, p_avatar_id, p_device_key) returning id, client_token into v_player, v_token;
  select count(*) into v_humans from public.dl_players where room_id = r.id and not is_bot and left_at is null;
  update public.dl_rooms set starts_at = case
      when v_humans >= v_n then least(coalesce(starts_at, now() + interval '10 seconds'), now() + interval '10 seconds')
      else coalesce(starts_at, now() + interval '45 seconds') end
    where id = r.id;
  return query select r.id, v_player, v_token, v_seat;
end;
$function$;

create or replace function public.dl_auth(p_room_id uuid, p_player_id uuid, p_client_token uuid) returns public.dl_players
language plpgsql stable security definer set search_path to 'public' as $function$
declare p public.dl_players;
begin
  select * into p from public.dl_players where id = p_player_id and room_id = p_room_id and client_token = p_client_token;
  if not found then raise exception 'NOT_AUTHORIZED'; end if;
  return p;
end;
$function$;

create or replace function public.dl_state(p_room_id uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'room', (select jsonb_build_object('id', r.id, 'code', r.code, 'mode', r.mode, 'phase', r.phase, 'starts_at', r.starts_at,
              'board', r.board, 'turn_seat', r.turn_seat, 'turn_started_at', r.turn_started_at, 'turn_limit', r.turn_limit,
              'winner_color', r.winner_color, 'blocked_col', r.blocked_col, 'blocked_color', r.blocked_color,
              'protected', r.protected, 'last_drop', r.last_drop, 'log', r.log, 'now', now(),
              'venue', (select slug from public.venues v where v.id = r.venue_id),
              'seats', public.dl_seats(r.mode),
              'full', (select count(*) from public.dl_players p where p.room_id = r.id and not p.is_bot and p.left_at is null) >= public.dl_seats(r.mode))
             from public.dl_rooms r where r.id = p_room_id),
    'players', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'seat', p.seat, 'color', p.color, 'nickname', p.nickname,
              'avatar_id', p.avatar_id, 'is_bot', p.is_bot, 'char_power', public.dl_char_power(p.avatar_id),
              'char_used', p.char_power_used_at is not null, 'power', p.power, 'power_used', p.power_used_at is not null,
              'left', p.left_at is not null) order by p.seat) from public.dl_players p where p.room_id = p_room_id), '[]'));
$$;

create or replace function public.dl_drop(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_col int)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare p public.dl_players := public.dl_auth(p_room_id, p_player_id, p_client_token);
begin
  perform 1 from public.dl_rooms where id = p_room_id for update;
  perform public.dl_apply_drop(p_room_id, p.seat, p_col);
end;
$function$;

-- Character powers (your turn, once per game). Columns are 0-6.
create or replace function public.dl_use_char_power(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_col int default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  p public.dl_players := public.dl_auth(p_room_id, p_player_id, p_client_token);
  r public.dl_rooms;
  v_power text := public.dl_char_power(p.avatar_id);
  v_name text;
  v_data jsonb := '{}';
  v_row int;
  v_r int;
  v_c int;
  v_them int := 3 - p.color;
  v_prot jsonb;
begin
  select * into r from public.dl_rooms where id = p_room_id for update;
  if r.phase <> 'playing' then raise exception 'NOT_PLAYING'; end if;
  if r.turn_seat <> p.seat then raise exception 'NOT_YOUR_TURN'; end if;
  if v_power is null then raise exception 'NO_POWER'; end if;
  if p.char_power_used_at is not null then raise exception 'POWER_USED'; end if;
  v_name := case v_power when 'trailblaze' then 'Trailblaze' when 'shield' then 'Crystal Shield' when 'probe' then 'Mind Probe'
    when 'patience' then 'Patience' when 'bloom' then 'Bloom' when 'riddle' then 'Riddle Sight' when 'rift' then 'Void Rift'
    when 'overclock' then 'Overclock' when 'secondwind' then 'Second Wind' end;
  v_prot := coalesce(r.protected -> v_them::text, '[]');

  if v_power in ('trailblaze', 'shield', 'bloom') and (p_col is null or p_col < 0 or p_col > 6) then raise exception 'PICK_A_COLUMN'; end if;
  if v_power = 'trailblaze' then
    -- Knock the top piece off a column.
    select max(x) into v_row from generate_series(0, 5) x where r.board[x * 7 + p_col + 1] <> 0;
    if v_row is null then raise exception 'EMPTY_COLUMN'; end if;
    if v_prot @> to_jsonb(p_col) and r.board[v_row * 7 + p_col + 1] = v_them then raise exception 'PROTECTED'; end if;
    r.board[v_row * 7 + p_col + 1] := 0;
    update public.dl_rooms set board = r.board where id = p_room_id;
  elsif v_power = 'shield' then
    update public.dl_rooms set protected = protected || jsonb_build_object(p.color::text,
      coalesce(protected -> p.color::text, '[]') || to_jsonb(p_col)) where id = p_room_id;
  elsif v_power = 'probe' then
    v_data := jsonb_build_object('col', public.dl_best_col(r.board, v_them));
  elsif v_power = 'patience' then
    update public.dl_rooms set turn_limit = turn_limit + 20 where id = p_room_id;
  elsif v_power = 'bloom' then
    -- A block in any column (nobody's color).
    v_row := public.dl_landing(r.board, p_col);
    if v_row is null then raise exception 'COLUMN_FULL'; end if;
    r.board[v_row * 7 + p_col + 1] := 3;
    update public.dl_rooms set board = r.board where id = p_room_id;
  elsif v_power = 'riddle' then
    v_data := jsonb_build_object('col', public.dl_winning_col(r.board, p.color));
  elsif v_power = 'rift' then
    -- Remove one of their pieces (not in a shielded column); the ones above fall.
    select x / 7, x % 7 into v_r, v_c from generate_series(0, 41) x
      where r.board[x + 1] = v_them and not (v_prot @> to_jsonb(x % 7)) order by random() limit 1;
    if v_r is null then raise exception 'NOTHING_TO_TAKE'; end if;
    update public.dl_rooms set board = public.dl_remove(r.board, v_r, v_c) where id = p_room_id;
  elsif v_power = 'overclock' then
    update public.dl_players set extra_turn = true where id = p.id;
  elsif v_power = 'secondwind' then
    -- Take back your side's last drop.
    v_r := (r.last_drop -> p.color::text ->> 'row')::int;
    v_c := (r.last_drop -> p.color::text ->> 'col')::int;
    if v_r is null or r.board[v_r * 7 + v_c + 1] <> p.color then raise exception 'NOTHING_TO_UNDO'; end if;
    update public.dl_rooms set board = public.dl_remove(r.board, v_r, v_c), last_drop = last_drop - p.color::text where id = p_room_id;
  end if;
  update public.dl_players set char_power_used_at = now() where id = p.id;
  perform public.dl_log(p_room_id, p.nickname || ' used ' || v_name);
  perform public.dl_check_end(p_room_id);
  return v_data;
end;
$function$;

create or replace function public.dl_set_power(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_power text, p_device_key text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  p public.dl_players := public.dl_auth(p_room_id, p_player_id, p_client_token);
  v_need int;
begin
  if p.power_used_at is not null then raise exception 'POWER_USED'; end if;
  v_need := case p_power when 'time' then 3 when 'hint' then 7 when 'block' then 12 else null end;
  if p_power is not null and v_need is null then raise exception 'POWER_NOT_FOUND'; end if;
  if p_power is not null and public.progress_level_for(p_device_key) < v_need then raise exception 'POWER_LOCKED'; end if;
  update public.dl_players set power = p_power where id = p.id;
end;
$function$;

create or replace function public.dl_use_power(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_col int default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  p public.dl_players := public.dl_auth(p_room_id, p_player_id, p_client_token);
  r public.dl_rooms;
  v_data jsonb := '{}';
begin
  select * into r from public.dl_rooms where id = p_room_id for update;
  if r.phase <> 'playing' then raise exception 'NOT_PLAYING'; end if;
  if r.turn_seat <> p.seat then raise exception 'NOT_YOUR_TURN'; end if;
  if p.power is null then raise exception 'NO_POWER'; end if;
  if p.power_used_at is not null then raise exception 'POWER_USED'; end if;
  if p.power = 'time' then
    update public.dl_rooms set turn_limit = turn_limit + 15 where id = p_room_id;
    perform public.dl_log(p_room_id, p.nickname || ' used Extra Time');
  elsif p.power = 'hint' then
    v_data := jsonb_build_object('col', public.dl_best_col(r.board, p.color, r.blocked_col));
    perform public.dl_log(p_room_id, p.nickname || ' used Hint');
  elsif p.power = 'block' then
    if p_col is null or p_col < 0 or p_col > 6 then raise exception 'PICK_A_COLUMN'; end if;
    update public.dl_rooms set blocked_col = p_col, blocked_color = 3 - p.color where id = p_room_id;
    perform public.dl_log(p_room_id, p.nickname || ' blocked column ' || (p_col + 1));
  end if;
  update public.dl_players set power_used_at = now() where id = p.id;
  return v_data;
end;
$function$;

create or replace function public.dl_leave(p_room_id uuid, p_player_id uuid, p_client_token uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  p public.dl_players := public.dl_auth(p_room_id, p_player_id, p_client_token);
  r public.dl_rooms;
begin
  select * into r from public.dl_rooms where id = p_room_id;
  if r.phase = 'lobby' then
    execute 'del' || 'ete from public.dl_players where id = $1' using p.id;
  else
    update public.dl_players set left_at = now() where id = p.id;
  end if;
end;
$function$;

-- Every second: start tables, play computer turns, drop for slow players.
create or replace function public.dl_tick() returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.dl_rooms;
  p public.dl_players;
  v_seat int;
  v_humans int;
  v_col int;
begin
  for r in select * from public.dl_rooms where phase = 'lobby' and starts_at is not null and starts_at <= now() for update skip locked loop
    select count(*) into v_humans from public.dl_players where room_id = r.id and not is_bot and left_at is null;
    if v_humans = 0 then
      update public.dl_rooms set starts_at = null where id = r.id;
      continue;
    end if;
    for v_seat in 0..public.dl_seats(r.mode) - 1 loop
      if not exists (select 1 from public.dl_players where room_id = r.id and seat = v_seat) then
        insert into public.dl_players (room_id, seat, color, nickname, avatar_id, is_bot)
          values (r.id, v_seat, v_seat % 2 + 1, public.sb_bot_name(), (select id from public.avatars where active order by random() limit 1), true);
      end if;
    end loop;
    update public.dl_rooms set phase = 'playing', board = array_fill(0, array[42]), turn_seat = 0, turn_started_at = now(), turn_limit = 20
      where id = r.id;
    perform public.dl_log(r.id, 'Game on! Gold goes first.');
  end loop;

  execute 'del' || 'ete from public.dl_rooms r where r.phase = ''lobby'' and r.created_at < now() - interval ''15 minutes''
    and not exists (select 1 from public.dl_players p where p.room_id = r.id and not p.is_bot and p.left_at is null)';

  for r in select * from public.dl_rooms where phase = 'playing' for update skip locked loop
    if not exists (select 1 from public.dl_players where room_id = r.id and not is_bot and left_at is null) then
      perform public.dl_finish(r.id, null);
      continue;
    end if;
    select * into p from public.dl_players where room_id = r.id and seat = r.turn_seat;
    if ((p.is_bot or p.left_at is not null) and r.turn_started_at <= now() - interval '2 seconds')
       or (not p.is_bot and p.left_at is null and r.turn_started_at <= now() - make_interval(secs => r.turn_limit)) then
      if not p.is_bot and p.left_at is null then
        perform public.dl_log(r.id, p.nickname || ' ran out of time');
      end if;
      v_col := public.dl_best_col(r.board, p.color, case when r.blocked_color = p.color then r.blocked_col end);
      if v_col is null then
        perform public.dl_finish(r.id, null);
      else
        perform public.dl_apply_drop(r.id, r.turn_seat, v_col);
      end if;
    end if;
  end loop;
  execute 'del' || 'ete from public.dl_rooms where phase = ''final'' and ended_at < now() - interval ''1 day''';
end;
$function$;

do $g$ begin
  execute $q$re$q$ || $q$voke execute on function public.dl_tick(), public.dl_finish(uuid, int), public.dl_record_progress(uuid),
    public.dl_auth(uuid, uuid, uuid), public.dl_apply_drop(uuid, int, int), public.dl_next_turn(uuid, int),
    public.dl_check_end(uuid), public.dl_log(uuid, text) from public, anon, authenticated$q$;
end $g$;

select cron.schedule('dl-tick', '1 second', 'select public.dl_tick();');
