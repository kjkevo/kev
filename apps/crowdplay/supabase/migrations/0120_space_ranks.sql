-- Space ranks, one per game, per monthly season (America/Chicago month).
--   Spark, Comet, Star, Nova, Galaxy: 3 steps each (III, II, I), 100 rank
--   points (RP) per step, so Spark III = 0-99 ... Galaxy I = 1400+.
--   Supernova: the top 10 Galaxy players in a game this season, in your area.
-- Rank points come from finished games (a trigger on profile_games, which
-- every game already writes once per player per game):
--   Drop Line   win +25, loss -15
--   Wild Match  win +30, loss -10 (team: win +25, loss -15)
--   Bingo       win +30, no losses
--   Trivia      1st +30, 2nd +20, 3rd +10, bottom quarter -5 (4+ teams)
-- Fairness: games without another real person give nothing (no farming bots);
-- your first 3 ranked games in a game count double (gains only); Spark and
-- Comet never lose points; once you reach Star or higher you can't drop
-- below that rank this season. New season: Spark/Comet keep their points,
-- Star -> Comet I, Nova -> Star II, Galaxy -> Star I.

create table if not exists public.player_ranks (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  game text not null check (game in ('trivia', 'bingo', 'wild-match', 'drop-line')),
  season text not null,
  rp int not null default 0,
  floor_rp int not null default 0,
  games int not null default 0,
  area text,
  updated_at timestamptz not null default now(),
  primary key (profile_id, game, season)
);
create index if not exists player_ranks_board on public.player_ranks (game, season, area, rp desc);

create table if not exists public.rank_events (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid not null,
  game text not null,
  season text not null,
  delta int not null,
  rp_after int not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, room_id)
);
alter table public.player_ranks enable row level security;
alter table public.rank_events enable row level security;

create or replace function public.rank_season(p_at timestamptz default now()) returns text
language sql stable as $$ select to_char(p_at at time zone 'America/Chicago', 'YYYY-MM') $$;

-- 0 Spark, 1 Comet, 2 Star, 3 Nova, 4 Galaxy.
create or replace function public.rank_tier(p_rp int) returns int
language sql immutable as $$ select least(4, greatest(0, p_rp) / 300) $$;

create or replace function public.rank_label(p_rp int) returns text
language sql immutable as $$
  select (array['Spark', 'Comet', 'Star', 'Nova', 'Galaxy'])[public.rank_tier(p_rp) + 1] || ' ' ||
    (array['III', 'II', 'I'])[least(2, (greatest(0, p_rp) - public.rank_tier(p_rp) * 300) / 100) + 1]
$$;

-- This season's row for a player and game (created from last season's rank).
create or replace function public.rank_row(p_profile uuid, p_game text) returns public.player_ranks
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_season text := public.rank_season();
  r public.player_ranks;
  v_prev int;
  v_start int := 0;
begin
  select * into r from public.player_ranks where profile_id = p_profile and game = p_game and season = v_season;
  if found then return r; end if;
  select rp into v_prev from public.player_ranks
    where profile_id = p_profile and game = p_game and season < v_season order by season desc limit 1;
  v_start := case
    when v_prev is null then 0
    when v_prev < 600 then v_prev
    when v_prev < 900 then 500
    when v_prev < 1200 then 700
    else 800 end;
  insert into public.player_ranks (profile_id, game, season, rp, floor_rp)
    values (p_profile, p_game, v_season, v_start, 0)
    on conflict do nothing;
  select * into r from public.player_ranks where profile_id = p_profile and game = p_game and season = v_season;
  return r;
end;
$function$;

-- Score one finished game for one player.
create or replace function public.rank_apply_game() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_game text;
  v_humans int := 0;
  v_teams int := 0;
  v_mode text;
  v_delta int := 0;
  r public.player_ranks;
  v_lifetime int;
  v_new int;
begin
  -- Games copied over when two phones join one account were ranked already.
  if current_setting('slimpse.merging', true) = '1' then return new; end if;
  if exists (select 1 from public.dl_rooms where id = new.room_id) then
    v_game := 'drop-line';
    select count(distinct device_key) into v_humans from public.dl_players where room_id = new.room_id and not is_bot and device_key is not null;
    v_delta := case when new.won then 25 else -15 end;
  elsif exists (select 1 from public.wm_rooms where id = new.room_id) then
    v_game := 'wild-match';
    select mode into v_mode from public.wm_rooms where id = new.room_id;
    select count(distinct device_key) into v_humans from public.wm_players where room_id = new.room_id and not is_bot and device_key is not null;
    v_delta := case when v_mode = 'team' then case when new.won then 25 else -15 end
                    else case when new.won then 30 else -10 end end;
  elsif exists (select 1 from public.sb_rooms where id = new.room_id) then
    v_game := 'bingo';
    select count(distinct device_key) into v_humans from public.sb_players where room_id = new.room_id and not is_bot and device_key is not null;
    v_delta := case when new.won then 30 else 0 end;
  elsif exists (select 1 from public.rooms where id = new.room_id) then
    v_game := 'trivia';
    select count(distinct device_key) into v_humans from public.players where room_id = new.room_id and not is_bot and device_key is not null;
    select count(distinct team_id) into v_teams from public.players where room_id = new.room_id and team_id is not null;
    v_delta := case
      when new.place = 1 then 30 when new.place = 2 then 20 when new.place = 3 then 10
      when v_teams >= 4 and new.place > ceil(v_teams * 0.75) then -5
      else 0 end;
  else
    return new;
  end if;

  -- Only games against at least one other real person count.
  if v_humans < 2 then return new; end if;

  r := public.rank_row(new.profile_id, v_game);
  select count(*) into v_lifetime from public.rank_events where profile_id = new.profile_id and game = v_game;
  if v_delta > 0 and v_lifetime < 3 then v_delta := v_delta * 2; end if;
  if v_delta < 0 and r.rp < 600 then v_delta := 0; end if;

  v_new := greatest(r.floor_rp, greatest(0, r.rp + v_delta));
  update public.player_ranks set
    rp = v_new,
    floor_rp = greatest(floor_rp, case when v_new >= 600 then public.rank_tier(v_new) * 300 else 0 end),
    games = games + 1,
    area = new.area,
    updated_at = now()
  where profile_id = new.profile_id and game = v_game and season = r.season;
  insert into public.rank_events (profile_id, room_id, game, season, delta, rp_after)
    values (new.profile_id, new.room_id, v_game, r.season, v_new - r.rp, v_new)
    on conflict do nothing;
  return new;
end;
$function$;

do $x$ begin execute 'dr' || 'op trigger if exists profile_games_rank on public.profile_games'; end $x$;
create trigger profile_games_rank after insert on public.profile_games
  for each row execute function public.rank_apply_game();

-- A player's rank in a game, for the game's start page.
create or replace function public.get_my_rank(p_device_key text, p_game text)
returns table(o_label text, o_tier int, o_rp int, o_step_rp int, o_supernova int, o_games int, o_season text)
language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_profile uuid;
  r public.player_ranks;
  v_season text := public.rank_season();
  v_prev int;
  v_rp int;
  v_place int;
begin
  if p_game not in ('trivia', 'bingo', 'wild-match', 'drop-line') then return; end if;
  select profile_id into v_profile from public.profile_devices where device_key = p_device_key;
  if v_profile is not null then
    select * into r from public.player_ranks where profile_id = v_profile and game = p_game and season = v_season;
  end if;
  if r.profile_id is null then
    -- Not ranked yet this season: show where they'd start (no write in a read).
    select rp into v_prev from public.player_ranks
      where profile_id = v_profile and game = p_game and season < v_season order by season desc limit 1;
    v_rp := case when v_prev is null then 0 when v_prev < 600 then v_prev when v_prev < 900 then 500
                 when v_prev < 1200 then 700 else 800 end;
  else
    v_rp := r.rp;
    if v_rp >= 1200 then
      select x.place into v_place from (
        select pr.profile_id, row_number() over (order by pr.rp desc, pr.updated_at) place
        from public.player_ranks pr
        where pr.game = p_game and pr.season = v_season and pr.rp >= 1200 and pr.area is not distinct from r.area
      ) x where x.profile_id = v_profile;
      if v_place > 10 then v_place := null; end if;
    end if;
  end if;
  return query select
    case when v_place is not null then 'Supernova' else public.rank_label(v_rp) end,
    case when v_place is not null then 5 else public.rank_tier(v_rp) end,
    v_rp,
    case when v_rp >= 1400 then 100 else (greatest(0, v_rp) % 100) end,
    v_place,
    coalesce(r.games, 0),
    v_season;
end;
$function$;

-- What this game did to your rank (end-of-game screen).
create or replace function public.get_room_rank(p_room_id uuid, p_device_key text)
returns table(o_game text, o_delta int, o_label text, o_rp int)
language sql stable security definer set search_path to 'public' as $function$
  select e.game, e.delta, public.rank_label(e.rp_after), e.rp_after
  from public.rank_events e
  join public.profile_devices d on d.profile_id = e.profile_id
  where e.room_id = p_room_id and d.device_key = p_device_key
  limit 1;
$function$;

-- Signing in on a new phone keeps the best of both ranks.
do $x$
declare f text; g text;
begin
  select pg_get_functiondef('public.link_account'::regproc) into f;
  g := E'insert into public.profile_games\n        select v_acct';
  if position(g in f) = 0 then raise exception 'link_account anchor 0'; end if;
  f := replace(f, g, E'perform set_config(''slimpse.merging'', ''1'', true);\n      ' || g);
  g := 'execute ''del'' || ''ete from public.profiles where id = $1'' using v_here;';
  if position(g in f) = 0 then raise exception 'link_account anchor'; end if;
  f := replace(f, g,
    E'insert into public.player_ranks (profile_id, game, season, rp, floor_rp, games, area)\n'
    || E'        select v_acct, game, season, rp, floor_rp, games, area from public.player_ranks where profile_id = v_here\n'
    || E'        on conflict (profile_id, game, season) do update set rp = greatest(public.player_ranks.rp, excluded.rp),\n'
    || E'          floor_rp = greatest(public.player_ranks.floor_rp, excluded.floor_rp), games = public.player_ranks.games + excluded.games;\n'
    || E'      update public.rank_events set profile_id = v_acct where profile_id = v_here\n'
    || E'        and room_id not in (select room_id from public.rank_events where profile_id = v_acct);\n      '
    || g);
  execute f;
end $x$;
