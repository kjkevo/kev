-- Bingo works like Trivia now: your character brings its own power (once per
-- game) and you can also bring one perk earned by leveling up.
--
-- Character powers in Bingo:
--   jungle-scout    Trailblaze    the next 3 numbers called mark themselves
--   crystal-titan   Catch Up      marks every called number you missed
--   alien-buddy     Mind Probe    see the next 2 numbers before they're called
--   forest-guardian Rebuild       swap one unmarked square for a number already called
--   stone-golem     Second Wind   a new card with every called number already marked
--   void-walker     Void Rift     removes 2 marks from the rival closest to Bingo
--   sylvan-entity   Overgrowth    the rival closest to Bingo can't mark for 15 seconds
--   geo-sphinx      Riddle Sight  mark any one square, called or not
--   model-z         Overclock     the next 5 numbers called mark themselves
-- Perks (levels like Trivia's): Sneak Peek Lv 3, Fresh Card Lv 7, Lucky Square Lv 12.
--
-- Countdown: 45 seconds from the first real player so friends and strangers
-- can arrive; once the game is full of real players (Solo 6, Team 3 teams)
-- it drops to 10 seconds. Computer players fill whatever is still empty.

alter table public.sb_players add column if not exists char_power_used_at timestamptz;
alter table public.sb_players add column if not exists char_power_data jsonb;
alter table public.sb_teams add column if not exists auto_until int not null default 0;
alter table public.sb_teams add column if not exists frozen_until timestamptz;

create or replace function public.sb_char_power(p_avatar text) returns text
language sql immutable as $$
  select case p_avatar
    when 'jungle-scout' then 'trailblaze' when 'crystal-titan' then 'catchup' when 'alien-buddy' then 'probe'
    when 'forest-guardian' then 'rebuild' when 'stone-golem' then 'secondwind' when 'void-walker' then 'rift'
    when 'sylvan-entity' then 'overgrowth' when 'geo-sphinx' then 'riddle' when 'model-z' then 'overclock' end;
$$;

-- Perk levels now match Trivia's spacing; "wild" is renamed Lucky Square.
create or replace function public.sb_set_power(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_power text, p_device_key text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  p public.sb_players := public.sb_auth(p_room_id, p_player_id, p_client_token);
  v_need int;
begin
  if p.power_used_at is not null then raise exception 'POWER_USED'; end if;
  v_need := case p_power when 'peek' then 3 when 'fresh' then 7 when 'wild' then 12 else null end;
  if p_power is not null and v_need is null then raise exception 'POWER_NOT_FOUND'; end if;
  if p_power is not null and public.progress_level_for(p_device_key) < v_need then raise exception 'POWER_LOCKED'; end if;
  update public.sb_players set power = p_power where id = p.id;
end;
$function$;

-- The rival team (not yours) with the most squares in one line.
create or replace function public.sb_closest_rival(p_room_id uuid, p_team uuid) returns uuid
language sql stable security definer set search_path to 'public' as $$
  select t.id from public.sb_teams t
  cross join lateral (
    select max((select count(*) from unnest(l.idx) i where t.marks[i])) best from (values
      (array[1,2,3,4,5]), (array[6,7,8,9,10]), (array[11,12,13,14,15]), (array[16,17,18,19,20]), (array[21,22,23,24,25]),
      (array[1,6,11,16,21]), (array[2,7,12,17,22]), (array[3,8,13,18,23]), (array[4,9,14,19,24]), (array[5,10,15,20,25]),
      (array[1,7,13,19,25]), (array[5,9,13,17,21])) l(idx)) b
  where t.room_id = p_room_id and t.id <> p_team
  order by b.best desc, random() limit 1;
$$;

-- Use your character's power. Rebuild needs the square (1-25); Riddle Sight too.
create or replace function public.sb_use_char_power(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_index int default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  p public.sb_players := public.sb_auth(p_room_id, p_player_id, p_client_token);
  r public.sb_rooms;
  t public.sb_teams;
  v_power text := public.sb_char_power(p.avatar_id);
  v_data jsonb := '{}';
  v_rival uuid;
  rt public.sb_teams;
  n int;
  i int;
  v_num int;
  v_removed int := 0;
begin
  select * into r from public.sb_rooms where id = p_room_id;
  if r.phase <> 'playing' then raise exception 'NOT_PLAYING'; end if;
  if v_power is null then raise exception 'NO_POWER'; end if;
  if p.char_power_used_at is not null then raise exception 'POWER_USED'; end if;
  select * into t from public.sb_teams where id = p.team_id for update;
  n := coalesce(array_length(r.calls, 1), 0);

  if v_power in ('trailblaze', 'overclock') then
    update public.sb_teams set auto_until = greatest(auto_until, n + case when v_power = 'overclock' then 5 else 3 end) where id = t.id;
  elsif v_power = 'catchup' then
    for i in 1..25 loop
      if t.card[i] = any(r.calls) then t.marks[i] := true; end if;
    end loop;
    update public.sb_teams set marks = t.marks where id = t.id;
  elsif v_power = 'probe' then
    v_data := jsonb_build_object('next', r.deck[n + 1:n + 2], 'after_calls', n);
  elsif v_power = 'rebuild' then
    if p_index is null or p_index < 1 or p_index > 25 or p_index = 13 or t.marks[p_index] then raise exception 'PICK_A_SQUARE'; end if;
    select c into v_num from unnest(r.calls) c where not (c = any(t.card))
      and c between (((p_index - 1) % 5) * 15 + 1) and (((p_index - 1) % 5) * 15 + 15) order by random() limit 1;
    if v_num is null then
      select c into v_num from unnest(r.calls) c where not (c = any(t.card)) order by random() limit 1;
    end if;
    if v_num is null then raise exception 'NOTHING_TO_SWAP'; end if;
    t.card[p_index] := v_num;
    t.marks[p_index] := true;
    update public.sb_teams set card = t.card, marks = t.marks where id = t.id;
    v_data := jsonb_build_object('square', p_index, 'number', v_num);
  elsif v_power = 'secondwind' then
    t.card := public.sb_new_card();
    t.marks := public.sb_blank_marks();
    for i in 1..25 loop
      if t.card[i] = any(r.calls) then t.marks[i] := true; end if;
    end loop;
    update public.sb_teams set card = t.card, marks = t.marks where id = t.id;
  elsif v_power = 'rift' then
    v_rival := public.sb_closest_rival(p_room_id, t.id);
    if v_rival is null then raise exception 'NO_RIVAL'; end if;
    select * into rt from public.sb_teams where id = v_rival for update;
    for i in select x from generate_series(1, 25) x where rt.marks[x] and x <> 13 order by random() limit 2 loop
      rt.marks[i] := false;
      v_removed := v_removed + 1;
    end loop;
    update public.sb_teams set marks = rt.marks, bot_bingo_at = case when public.sb_has_line(rt.marks) then bot_bingo_at end where id = rt.id;
    v_data := jsonb_build_object('target_name', rt.name, 'removed', v_removed);
  elsif v_power = 'overgrowth' then
    v_rival := public.sb_closest_rival(p_room_id, t.id);
    if v_rival is null then raise exception 'NO_RIVAL'; end if;
    update public.sb_teams set frozen_until = now() + interval '15 seconds',
      bot_bingo_at = case when bot_bingo_at is not null then greatest(bot_bingo_at, now() + interval '15 seconds') end
      where id = v_rival;
    v_data := jsonb_build_object('target_name', (select name from public.sb_teams where id = v_rival));
  elsif v_power = 'riddle' then
    if p_index is null or p_index < 1 or p_index > 25 or p_index = 13 then raise exception 'PICK_A_SQUARE'; end if;
    t.marks[p_index] := true;
    update public.sb_teams set marks = t.marks where id = t.id;
  end if;

  update public.sb_players set char_power_used_at = now(), char_power_data = v_data || jsonb_build_object('power', v_power) where id = p.id;
  return v_data;
end;
$function$;

-- Marking respects Overgrowth (frozen) now.
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
  if t.frozen_until is not null and t.frozen_until > now() then raise exception 'FROZEN'; end if;
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

-- Your power results (Mind Probe and Sneak Peek numbers are only shown to you).
create or replace function public.sb_my_power(p_room_id uuid, p_player_id uuid, p_client_token uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object('power', p.power, 'used', p.power_used_at is not null, 'data', p.power_data,
    'char_power', public.sb_char_power(p.avatar_id), 'char_used', p.char_power_used_at is not null, 'char_data', p.char_power_data)
  from public.sb_players p where p.id = (public.sb_auth(p_room_id, p_player_id, p_client_token)).id;
$$;

-- State now says who has used their character power, and each team's
-- auto-mark / frozen status.
create or replace function public.sb_state(p_room_id uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'room', (select jsonb_build_object('id', r.id, 'code', r.code, 'mode', r.mode, 'phase', r.phase,
              'starts_at', r.starts_at, 'calls', r.calls, 'last_call_at', r.last_call_at,
              'winner_team_id', r.winner_team_id, 'ended_at', r.ended_at, 'now', now(),
              'venue', (select slug from public.venues v where v.id = r.venue_id),
              'full', case when r.mode = 'solo'
                then (select count(*) from public.sb_players p where p.room_id = r.id and not p.is_bot and p.left_at is null) >= 6
                else (select count(*) from public.sb_teams t where t.room_id = r.id and not t.is_bot) >= 3 end)
             from public.sb_rooms r where r.id = p_room_id),
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'is_bot', t.is_bot,
              'card', t.card, 'marks', t.marks, 'auto_until', t.auto_until, 'frozen_until', t.frozen_until) order by t.created_at)
              from public.sb_teams t where t.room_id = p_room_id), '[]'),
    'players', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'team_id', p.team_id, 'nickname', p.nickname,
              'avatar_id', p.avatar_id, 'is_bot', p.is_bot, 'power', p.power, 'power_used', p.power_used_at is not null,
              'char_power', public.sb_char_power(p.avatar_id), 'char_used', p.char_power_used_at is not null,
              'char_data', case when p.char_power_used_at is not null then p.char_power_data - 'next' end,
              'left', p.left_at is not null) order by p.joined_at) from public.sb_players p where p.room_id = p_room_id), '[]'));
$$;

-- Joining: 45 seconds from the first real player; a full game starts in 10.
do $x$ declare d text; o text := '  if r.phase = ''lobby'' and r.starts_at is null then
    update public.sb_rooms set starts_at = now() + interval ''40 seconds'' where id = r.id;
  end if;
'; begin
  d := pg_get_functiondef('public.sb_join(text,text,text,text,uuid)'::regprocedure);
  if position(o in d) = 0 then raise exception 'sb_join: pattern missing'; end if;
  execute replace(d, o, '  if r.phase = ''lobby'' and r.starts_at is null then
    update public.sb_rooms set starts_at = now() + interval ''45 seconds'' where id = r.id;
  end if;
  if r.phase = ''lobby'' and (case when r.mode = ''solo''
      then (select count(*) from public.sb_players p where p.room_id = r.id and not p.is_bot and p.left_at is null) >= 6
      else (select count(*) from public.sb_teams t where t.room_id = r.id and not t.is_bot) >= 3 end) then
    update public.sb_rooms set starts_at = least(starts_at, now() + interval ''10 seconds'') where id = r.id;
  end if;
');
end $x$;

-- Calling: Trailblaze / Overclock mark the new number for teams that have it on.
do $x$ declare d text; o text := '    update public.sb_rooms set calls = calls || v_next, last_call_at = now() where id = r.id;
'; begin
  d := pg_get_functiondef('public.sb_tick()'::regprocedure);
  if position(o in d) = 0 then raise exception 'sb_tick: pattern missing'; end if;
  execute replace(d, o, o || '    update public.sb_teams st set marks[array_position(st.card, v_next)] = true
      where st.room_id = r.id and st.auto_until > v_n and array_position(st.card, v_next) is not null;
');
end $x$;

-- Bots can't mark while frozen by Overgrowth either.
do $x$ declare d text; o text := '      if v_i is not null and random() < 0.75 then'; begin
  d := pg_get_functiondef('public.sb_tick()'::regprocedure);
  if position(o in d) = 0 then raise exception 'sb_tick: bot pattern missing'; end if;
  execute replace(d, o, '      if v_i is not null and random() < 0.75 and (t.frozen_until is null or t.frozen_until <= now()) then');
end $x$;
