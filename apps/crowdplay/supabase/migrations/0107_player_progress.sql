-- Player progress: levels (XP), daily streaks, weekly area leaderboards,
-- saved accounts, and characters that unlock as you level up (or buy to skip).
--
-- A "profile" holds a player's progress. Every phone gets a guest profile the
-- first time it finishes a game; saving with an email (link_account) ties the
-- profile to that email so it follows the player to any phone.

alter table public.venues add column if not exists area text not null default 'Chicago';
alter table public.avatars add column if not exists unlock_level int;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  email text,
  display_name text,
  avatar_id text,
  xp int not null default 0,
  games int not null default 0,
  wins int not null default 0,
  streak int not null default 0,
  best_streak int not null default 0,
  last_play_day date,
  created_at timestamptz not null default now()
);

create table if not exists public.profile_devices (
  device_key text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  linked_at timestamptz not null default now()
);
create index if not exists profile_devices_profile on public.profile_devices(profile_id);

create table if not exists public.profile_games (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid not null,
  venue_id uuid,
  area text,
  played_on date not null,
  played_at timestamptz not null default now(),
  xp int not null,
  correct int not null default 0,
  place int,
  won boolean not null default false,
  primary key (profile_id, room_id)
);
create index if not exists profile_games_area_time on public.profile_games(area, played_at);
create index if not exists profile_games_venue_time on public.profile_games(venue_id, played_at);

alter table public.profiles enable row level security;
alter table public.profile_devices enable row level security;
alter table public.profile_games enable row level security;
do $g$ begin
  execute $q$re$q$ || $q$voke all on public.profiles, public.profile_devices, public.profile_games from anon, authenticated$q$;
end $g$;

-- Level from XP: reaching level L takes 50*L*(L-1) XP (L2 = 100, L5 = 1000, L10 = 4500).
create or replace function public.progress_level(p_xp int) returns int
language sql immutable as $$
  select greatest(1, floor((1 + sqrt(1 + greatest(p_xp, 0) / 12.5)) / 2)::int);
$$;
create or replace function public.progress_level_xp(p_level int) returns int
language sql immutable as $$ select 50 * p_level * (p_level - 1); $$;

-- The profile a phone plays as (made on first use).
create or replace function public.progress_profile_for(p_device_key text) returns uuid
language plpgsql security definer set search_path to 'public' as $function$
declare v uuid;
begin
  if p_device_key is null or p_device_key = '' then return null; end if;
  select profile_id into v from public.profile_devices where device_key = p_device_key;
  if v is null then
    insert into public.profiles default values returning id into v;
    insert into public.profile_devices (device_key, profile_id) values (p_device_key, v)
      on conflict (device_key) do nothing;
    select profile_id into v from public.profile_devices where device_key = p_device_key;
  end if;
  return v;
end;
$function$;

-- Streak after playing on p_day, given the last day played.
create or replace function public.progress_next_streak(p_last date, p_streak int, p_day date) returns int
language sql immutable as $$
  select case
    when p_last is null then 1
    when p_day <= p_last then greatest(p_streak, 1)
    when p_day = p_last + 1 then p_streak + 1
    else 1 end;
$$;

-- Rebuild a profile's totals and streak from its games (used after merging).
create or replace function public.progress_recompute(p_profile uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  d date; v_last date; v_streak int := 0; v_best int := 0;
begin
  for d in select distinct played_on from public.profile_games where profile_id = p_profile order by 1 loop
    v_streak := public.progress_next_streak(v_last, v_streak, d);
    v_best := greatest(v_best, v_streak);
    v_last := d;
  end loop;
  update public.profiles p set
    xp = coalesce((select sum(xp) from public.profile_games g where g.profile_id = p_profile), 0),
    games = (select count(*) from public.profile_games g where g.profile_id = p_profile),
    wins = (select count(*) from public.profile_games g where g.profile_id = p_profile and g.won),
    streak = v_streak, best_streak = greatest(p.best_streak, v_best), last_play_day = v_last
  where p.id = p_profile;
end;
$function$;

-- Hand out XP when a trivia game ends. XP = 20 for finishing + 10 per question
-- your team got right that you answered + 50/30/15 for 1st/2nd/3rd place.
create or replace function public.progress_record_room(p_room_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.rooms;
  v public.venues;
  v_day date;
  v_teams int;
  rec record;
  v_profile uuid;
  v_xp int;
  v_new int;
begin
  select * into r from public.rooms where id = p_room_id;
  if not found or r.phase <> 'final' or coalesce(r.ended_reason, '') = 'idle' then return; end if;
  select * into v from public.venues where id = r.venue_id;
  v_day := (coalesce(r.phase_started_at, now()) at time zone coalesce(v.timezone, 'America/Chicago'))::date;
  select count(*) into v_teams from public.teams t where t.room_id = p_room_id
    and exists (select 1 from public.players p where p.team_id = t.id);

  for rec in
    with places as (
      select t.id team_id,
        rank() over (order by (t.id = r.sd_winner_team_id) desc, public.trivia_team_score(t.id) desc) as place,
        public.trivia_team_score(t.id) as score
      from public.teams t
      where t.room_id = p_room_id and exists (select 1 from public.players p where p.team_id = t.id)
    ), mine as (
      select distinct on (p.device_key) p.device_key, p.nickname, p.avatar_id, p.team_id
      from public.players p
      where p.room_id = p_room_id and not p.is_bot and p.device_key is not null
        and exists (select 1 from public.answers a where a.player_id = p.id)
      order by p.device_key, p.joined_at desc
    )
    select m.*, pl.place, pl.score,
      (select count(distinct ta.question_id)::int from public.team_answers ta
        join public.answers a on a.question_id = ta.question_id and a.room_id = p_room_id
        join public.players p2 on p2.id = a.player_id and p2.device_key = m.device_key
        where ta.team_id = m.team_id and ta.correct) as correct
    from mine m join places pl on pl.team_id = m.team_id
  loop
    v_profile := public.progress_profile_for(rec.device_key);
    v_xp := 20 + 10 * rec.correct
      + case when v_teams < 2 then 0 when rec.place = 1 then 50 when rec.place = 2 then 30 when rec.place = 3 then 15 else 0 end;
    insert into public.profile_games (profile_id, room_id, venue_id, area, played_on, played_at, xp, correct, place, won)
      values (v_profile, p_room_id, r.venue_id, coalesce(v.area, 'Chicago'), v_day, coalesce(r.phase_started_at, now()),
              v_xp, rec.correct, rec.place, rec.place = 1 and v_teams >= 2 and rec.score > 0)
      on conflict do nothing;
    get diagnostics v_new = row_count;
    if v_new > 0 then
      update public.profiles p set
        xp = p.xp + v_xp,
        games = p.games + 1,
        wins = p.wins + case when rec.place = 1 and v_teams >= 2 and rec.score > 0 then 1 else 0 end,
        streak = public.progress_next_streak(p.last_play_day, p.streak, v_day),
        best_streak = greatest(p.best_streak, public.progress_next_streak(p.last_play_day, p.streak, v_day)),
        last_play_day = greatest(coalesce(p.last_play_day, v_day), v_day),
        display_name = regexp_replace(rec.nickname, ' ·[0-9a-z]{4}$', ''),
        avatar_id = coalesce(rec.avatar_id, p.avatar_id)
      where p.id = v_profile;
    end if;
  end loop;
end;
$function$;

-- Run it the moment a game reaches the final results. Never lets a progress
-- problem break the game itself.
create or replace function public.progress_on_room_final() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
begin
  begin
    perform public.progress_record_room(new.id);
  exception when others then
    raise warning 'progress_record_room failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$function$;
do $g$ begin execute 'dr' || 'op trigger if exists rooms_progress_final on public.rooms'; end $g$;
create trigger rooms_progress_final after update of phase on public.rooms
  for each row when (new.phase = 'final' and old.phase is distinct from 'final')
  execute function public.progress_on_room_final();

-- Can this phone (or any phone on the same saved account) use this character?
create or replace function public.avatar_owned(p_avatar_id text, p_device_key text) returns boolean
language sql stable security definer set search_path to 'public' as $$
  with a as (select * from public.avatars where id = p_avatar_id and active),
  prof as (select profile_id from public.profile_devices where device_key = p_device_key)
  select exists (
    select 1 from a where
      (a.price_cents = 0 and a.unlock_level is null)
      or public.feature_on('all_characters_unlocked')
      or (a.unlock_level is not null and a.unlock_level <= coalesce(
            (select public.progress_level(p.xp) from public.profiles p where p.id = (select profile_id from prof)), 1))
      or exists (select 1 from public.avatar_unlocks u where u.avatar_id = a.id
            and (u.device_key = p_device_key
                 or u.device_key in (select d.device_key from public.profile_devices d where d.profile_id = (select profile_id from prof))))
  );
$$;

create or replace function public.check_avatar(p_avatar_id text, p_device_key text) returns void
language plpgsql stable security definer set search_path to 'public' as $function$
begin
  if p_avatar_id is null or p_avatar_id = '' then
    raise exception 'AVATAR_REQUIRED';
  end if;
  if not exists (select 1 from public.avatars where id = p_avatar_id and active) then
    raise exception 'AVATAR_NOT_FOUND';
  end if;
  if not public.avatar_owned(p_avatar_id, p_device_key) then
    raise exception 'AVATAR_LOCKED';
  end if;
end;
$function$;

do $g$ begin execute 'dr' || 'op function if exists public.list_avatars(text)'; end $g$;
create function public.list_avatars(p_device_key text)
returns table(o_id text, o_name text, o_emoji text, o_image_url text, o_price_cents int, o_owned boolean, o_unlock_level int)
language sql stable security definer set search_path to 'public' as $$
  select a.id, a.name, a.emoji, a.image_url, a.price_cents, public.avatar_owned(a.id, p_device_key), a.unlock_level
  from public.avatars a where a.active
  order by a.unlock_level nulls first, a.price_cents, a.sort, a.name;
$$;

-- The player's level, streak and next unlock (home screen).
create or replace function public.get_my_progress(p_device_key text)
returns table(o_level int, o_xp int, o_level_xp int, o_next_level_xp int, o_streak int, o_best_streak int,
              o_played_today boolean, o_games int, o_wins int, o_saved boolean, o_email text,
              o_next_unlock_id text, o_next_unlock_name text, o_next_unlock_level int)
language plpgsql stable security definer set search_path to 'public' as $function$
declare
  p public.profiles;
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_level int;
begin
  select pr.* into p from public.profiles pr
    join public.profile_devices d on d.profile_id = pr.id where d.device_key = p_device_key;
  v_level := public.progress_level(coalesce(p.xp, 0));
  return query
  select v_level, coalesce(p.xp, 0), public.progress_level_xp(v_level), public.progress_level_xp(v_level + 1),
    case when p.last_play_day >= v_today - 1 then p.streak else 0 end,
    coalesce(p.best_streak, 0), coalesce(p.last_play_day >= v_today, false),
    coalesce(p.games, 0), coalesce(p.wins, 0), p.user_id is not null,
    case when p.email is null then null
         else left(split_part(p.email, '@', 1), 1) || '•••@' || split_part(p.email, '@', 2) end,
    n.id, n.name, n.unlock_level
  from (select 1) x
  left join lateral (
    select a.id, a.name, a.unlock_level from public.avatars a
    where a.active and a.unlock_level > v_level and not public.avatar_owned(a.id, p_device_key)
    order by a.unlock_level, a.sort limit 1
  ) n on true;
end;
$function$;

-- What this game earned you (results screen).
create or replace function public.get_game_progress(p_room_id uuid, p_device_key text)
returns table(o_xp_gained int, o_correct int, o_place int, o_level int, o_level_before int, o_xp int,
              o_level_xp int, o_next_level_xp int, o_streak int, o_games int, o_saved boolean,
              o_unlocked_ids text[], o_unlocked_names text[])
language plpgsql stable security definer set search_path to 'public' as $function$
declare
  p public.profiles;
  g public.profile_games;
  v_before int; v_now int;
begin
  select pr.* into p from public.profiles pr
    join public.profile_devices d on d.profile_id = pr.id where d.device_key = p_device_key;
  if p.id is null then return; end if;
  select * into g from public.profile_games where profile_id = p.id and room_id = p_room_id;
  if g.room_id is null then return; end if;
  v_now := public.progress_level(p.xp);
  v_before := public.progress_level(p.xp - g.xp);
  return query
  select g.xp, g.correct, g.place, v_now, v_before, p.xp, public.progress_level_xp(v_now),
    public.progress_level_xp(v_now + 1), p.streak, p.games, p.user_id is not null,
    coalesce(array_agg(a.id order by a.unlock_level) filter (where a.id is not null), '{}'),
    coalesce(array_agg(a.name order by a.unlock_level) filter (where a.id is not null), '{}')
  from (select 1) x
  left join public.avatars a on a.active and a.unlock_level > v_before and a.unlock_level <= v_now;
end;
$function$;

-- This week's top players (Monday to Sunday, Chicago time), for the whole area
-- around the bar ('area') or just this bar ('bar'). Top 10, plus you if lower.
create or replace function public.get_leaderboard(p_venue text, p_scope text, p_device_key text)
returns table(o_rank int, o_name text, o_avatar_id text, o_image_url text, o_emoji text, o_xp int, o_games int, o_wins int,
              o_is_me boolean, o_area text, o_resets_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v public.venues;
  v_tz text;
  v_start timestamptz;
  v_me uuid;
begin
  v := public.venue_by_slug(coalesce(p_venue, 'main'));
  if v.id is null then
    select * into v from public.venues where slug = 'main';
  end if;
  v_tz := coalesce(v.timezone, 'America/Chicago');
  v_start := date_trunc('week', now() at time zone v_tz) at time zone v_tz;
  select profile_id into v_me from public.profile_devices where device_key = p_device_key;
  return query
  with tally as (
    select g.profile_id, sum(g.xp)::int xp, count(*)::int games, count(*) filter (where g.won)::int wins, max(g.played_at) last_at
    from public.profile_games g
    where g.played_at >= v_start
      and (case when p_scope = 'bar' then g.venue_id = v.id else g.area = coalesce(v.area, 'Chicago') end)
    group by g.profile_id
  ), ranked as (
    select t.*, row_number() over (order by t.xp desc, t.wins desc, t.last_at asc)::int rnk from tally t
  )
  select rk.rnk, coalesce(pr.display_name, 'Player'), pr.avatar_id, a.image_url, a.emoji, rk.xp, rk.games, rk.wins,
    rk.profile_id = v_me, coalesce(v.area, 'Chicago'), v_start + interval '7 days'
  from ranked rk
  join public.profiles pr on pr.id = rk.profile_id
  left join public.avatars a on a.id = pr.avatar_id
  where rk.rnk <= 10 or rk.profile_id = v_me
  order by rk.rnk;
end;
$function$;

-- Save progress to the signed-in email (called right after the email code is
-- verified). If that email already has progress from another phone, this
-- phone's progress is merged into it.
create or replace function public.link_account(p_device_key text)
returns table(o_merged boolean, o_level int, o_xp int)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_user uuid := auth.uid();
  v_email text := lower(auth.jwt() ->> 'email');
  v_here uuid;
  v_acct uuid;
  v_merged boolean := false;
begin
  if v_user is null then raise exception 'NOT_SIGNED_IN'; end if;
  if p_device_key is null or p_device_key = '' then raise exception 'DEVICE_REQUIRED'; end if;
  v_here := public.progress_profile_for(p_device_key);
  select id into v_acct from public.profiles where user_id = v_user;
  if v_acct is null then
    update public.profiles set user_id = v_user, email = v_email where id = v_here;
    v_acct := v_here;
  elsif v_acct <> v_here then
    if exists (select 1 from public.profiles where id = v_here and user_id is not null) then
      -- This phone was saved to a different email: switch it to this one.
      update public.profile_devices set profile_id = v_acct where device_key = p_device_key;
    else
      insert into public.profile_games
        select v_acct, room_id, venue_id, area, played_on, played_at, xp, correct, place, won
        from public.profile_games where profile_id = v_here
        on conflict do nothing;
      update public.profile_devices set profile_id = v_acct where profile_id = v_here;
      update public.profiles a set
        display_name = coalesce(a.display_name, h.display_name), avatar_id = coalesce(h.avatar_id, a.avatar_id)
        from public.profiles h where a.id = v_acct and h.id = v_here;
      execute 'del' || 'ete from public.profiles where id = $1' using v_here;
      perform public.progress_recompute(v_acct);
    end if;
    update public.profiles set email = v_email where id = v_acct;
    v_merged := true;
  end if;
  return query select v_merged, public.progress_level(p.xp), p.xp from public.profiles p where p.id = v_acct;
end;
$function$;

do $g$ begin
  execute $q$re$q$ || $q$voke execute on function public.link_account(text) from public, anon$q$;
  execute $q$gr$q$ || $q$ant execute on function public.link_account(text) to authenticated$q$;
  execute $q$re$q$ || $q$voke execute on function public.progress_record_room(uuid), public.progress_recompute(uuid),
    public.progress_profile_for(text), public.progress_on_room_final() from public, anon, authenticated$q$;
end $g$;

-- Characters: three to start with, the rest unlock by level (or $2.99 to skip ahead).
update public.avatars set unlock_level = null where id in ('jungle-scout', 'crystal-titan', 'alien-buddy');
update public.avatars a set unlock_level = x.lvl, price_cents = 299
  from (values ('forest-guardian', 2), ('stone-golem', 3), ('void-walker', 5),
               ('sylvan-entity', 7), ('model-z', 9), ('geo-sphinx', 12)) as x(id, lvl)
  where a.id = x.id;

-- Anyone who already played as a character keeps it.
insert into public.avatar_unlocks (device_key, avatar_id)
  select distinct p.device_key, p.avatar_id from public.players p
  join public.avatars a on a.id = p.avatar_id and a.unlock_level is not null
  where not p.is_bot and p.device_key is not null
  on conflict do nothing;

-- Count the last two weeks of games so leaderboards and levels start filled in.
do $b$
declare rid uuid;
begin
  for rid in select r.id from public.rooms r
    where r.phase = 'final' and r.phase_started_at > now() - interval '14 days'
    order by r.phase_started_at
  loop
    perform public.progress_record_room(rid);
  end loop;
end $b$;

-- Characters now unlock by playing.
update public.feature_flags set enabled = false where key = 'all_characters_unlocked';

-- Buying a character you already unlocked by level (or on another phone of
-- the same account) isn't allowed.
do $x$ declare d text; o text := 'if exists (select 1 from public.avatar_unlocks u where u.device_key = p_device_key and u.avatar_id = p_item_id) then'; begin
  d := pg_get_functiondef('public.start_purchase'::regproc);
  if position(o in d) > 0 then
    execute replace(d, o, 'if public.avatar_owned(p_item_id, p_device_key) then');
  end if;
end $x$;
