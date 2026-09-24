-- Avatars, shoutouts and the live game feed ("carousel").
--
-- Avatars: one per player. Free ones are open to everyone; premium ones are
-- unlocked per phone (device_key, a random id the phone keeps in local
-- storage) once bought. A team shows its captain's avatar: whoever has been
-- on it longest.
--
-- Shoutouts: preset messages players send during a game. They show on every
-- phone in the room and on the venue's carousel after a 10-second delay, at
-- most one per player every 20 seconds, and a venue can switch them off.
--
-- Carousel: short live lines for the /qr page and the dashboard, e.g.
-- "Trivia · Team Red +1000". Points are shown here as they're earned (phones
-- still keep scores hidden until the end).

create table public.avatars (
  id text primary key,
  name text not null,
  emoji text,
  image_url text,
  price_cents int not null default 0 check (price_cents >= 0),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.avatars enable row level security;
create policy avatars_read on public.avatars for select to anon, authenticated using (active);

insert into public.avatars (id, name, emoji, sort) values
  ('fox', 'Fox', '🦊', 1), ('bear', 'Bear', '🐻', 2), ('frog', 'Frog', '🐸', 3), ('owl', 'Owl', '🦉', 4),
  ('octopus', 'Octopus', '🐙', 5), ('tiger', 'Tiger', '🐯', 6), ('penguin', 'Penguin', '🐧', 7), ('alien', 'Alien', '👽', 8);

alter table public.players add column if not exists avatar_id text references public.avatars(id);

create table public.avatar_unlocks (
  device_key text not null,
  avatar_id text not null references public.avatars(id),
  purchase_id uuid,
  created_at timestamptz not null default now(),
  primary key (device_key, avatar_id)
);
alter table public.avatar_unlocks enable row level security; -- read through list_avatars

-- Every active avatar, with whether this phone can use it.
create or replace function public.list_avatars(p_device_key text)
returns table(o_id text, o_name text, o_emoji text, o_image_url text, o_price_cents int, o_owned boolean)
language sql stable security definer set search_path to 'public' as $function$
  select a.id, a.name, a.emoji, a.image_url, a.price_cents,
    a.price_cents = 0 or exists (select 1 from public.avatar_unlocks u where u.device_key = p_device_key and u.avatar_id = a.id)
  from public.avatars a where a.active
  order by a.price_cents > 0, a.sort, a.name;
$function$;
grant execute on function public.list_avatars(text) to anon, authenticated;

create or replace function public.set_player_avatar(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_avatar_id text, p_device_key text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v_price int;
begin
  if not exists (select 1 from public.players pl where pl.id = p_player_id and pl.room_id = p_room_id
                 and pl.client_token = p_client_token and pl.left_at is null) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  select price_cents into v_price from public.avatars where id = p_avatar_id and active;
  if v_price is null then
    raise exception 'AVATAR_NOT_FOUND';
  end if;
  if v_price > 0 and not exists (select 1 from public.avatar_unlocks u where u.device_key = p_device_key and u.avatar_id = p_avatar_id) then
    raise exception 'AVATAR_LOCKED';
  end if;
  update public.players set avatar_id = p_avatar_id where id = p_player_id;
end;
$function$;
grant execute on function public.set_player_avatar(uuid, uuid, uuid, text, text) to anon, authenticated;

-- A team's avatar: its longest-standing active member's pick.
create or replace function public.team_avatar(p_team_id uuid)
returns table(o_emoji text, o_image_url text)
language sql stable security definer set search_path to 'public' as $function$
  select a.emoji, a.image_url
  from public.players pl join public.avatars a on a.id = pl.avatar_id
  where pl.team_id = p_team_id and pl.left_at is null
  order by pl.joined_at limit 1;
$function$;
revoke execute on function public.team_avatar(uuid) from anon, authenticated, public;

-- Shoutouts --------------------------------------------------------------

alter table public.venues add column if not exists shoutouts_enabled boolean not null default true;

create table public.shoutout_presets (
  id text primary key,
  text text not null,
  price_cents int not null default 0 check (price_cents >= 0),
  active boolean not null default true,
  sort int not null default 0
);
alter table public.shoutout_presets enable row level security;
create policy shoutout_presets_read on public.shoutout_presets for select to anon, authenticated using (active);

insert into public.shoutout_presets (id, text, sort) values
  ('lets-go', '🔥 Let''s go!', 1), ('cheers', '🍻 Cheers!', 2), ('no-way', '😱 No way!', 3),
  ('nice-one', '👏 Nice one!', 4), ('easy', '😎 Too easy', 5), ('so-close', '🤏 So close!', 6),
  ('big-brain', '🧠 Big brain move', 7), ('good-game', '🤝 Good game, everyone', 8);

create table public.shoutouts (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  venue_id uuid not null references public.venues(id),
  player_id uuid not null references public.players(id) on delete cascade,
  preset_id text references public.shoutout_presets(id),
  text text not null,
  created_at timestamptz not null default now(),
  show_at timestamptz not null default now() + interval '10 seconds',
  hidden boolean not null default false
);
create index shoutouts_room_idx on public.shoutouts (room_id, show_at);
create index shoutouts_venue_idx on public.shoutouts (venue_id, show_at);
alter table public.shoutouts enable row level security; -- read through get_shoutouts / get_carousel

create or replace function public.send_shoutout(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_preset_id text)
returns table(o_show_at timestamptz)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_room public.rooms;
  v_text text;
  v_price int;
  v_show timestamptz;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found or v_room.retired then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if not exists (select 1 from public.players pl where pl.id = p_player_id and pl.room_id = p_room_id
                 and pl.client_token = p_client_token and pl.left_at is null) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if not (select shoutouts_enabled from public.venues where id = v_room.venue_id) then
    raise exception 'SHOUTOUTS_OFF';
  end if;
  select text, price_cents into v_text, v_price from public.shoutout_presets where id = p_preset_id and active;
  if v_text is null then
    raise exception 'SHOUTOUT_NOT_FOUND';
  end if;
  if v_price > 0 then
    raise exception 'SHOUTOUT_LOCKED';
  end if;
  if exists (select 1 from public.shoutouts s where s.player_id = p_player_id and s.created_at > now() - interval '20 seconds') then
    raise exception 'SHOUTOUT_TOO_SOON';
  end if;
  insert into public.shoutouts (room_id, venue_id, player_id, preset_id, text)
    values (p_room_id, v_room.venue_id, p_player_id, p_preset_id, v_text)
    returning show_at into v_show;
  return query select v_show;
end;
$function$;
grant execute on function public.send_shoutout(uuid, uuid, uuid, text) to anon, authenticated;

-- Shoutouts that have cleared the delay, newest first.
create or replace function public.get_shoutouts(p_room_id uuid)
returns table(o_id bigint, o_text text, o_nickname text, o_team_name text, o_emoji text, o_image_url text, o_at timestamptz)
language sql stable security definer set search_path to 'public' as $function$
  select s.id, s.text, pl.nickname, t.name, a.emoji, a.image_url, s.show_at
  from public.shoutouts s
  join public.players pl on pl.id = s.player_id
  left join public.teams t on t.id = pl.team_id
  left join public.avatars a on a.id = pl.avatar_id
  where s.room_id = p_room_id and not s.hidden and s.show_at <= now()
    and (select shoutouts_enabled from public.venues v where v.id = s.venue_id)
  order by s.show_at desc limit 30;
$function$;
grant execute on function public.get_shoutouts(uuid) to anon, authenticated;

-- Game feed --------------------------------------------------------------

create table public.game_events (
  id bigint generated always as identity primary key,
  venue_id uuid not null references public.venues(id),
  room_id uuid references public.rooms(id) on delete cascade,
  game text not null default 'trivia',
  kind text not null,
  team_id uuid references public.teams(id) on delete set null,
  text text not null,
  created_at timestamptz not null default now()
);
create index game_events_venue_idx on public.game_events (venue_id, created_at desc);
alter table public.game_events enable row level security; -- read through get_carousel

-- "+1000" the moment a team's answer is scored right (locked in early or at the buzzer).
create or replace function public.game_events_on_team_answer()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if new.correct and new.points_awarded > 0 then
    insert into public.game_events (venue_id, room_id, kind, team_id, text)
      select r.venue_id, r.id, 'points', new.team_id, t.name || ' +' || new.points_awarded
      from public.rooms r join public.teams t on t.id = new.team_id
      where r.id = new.room_id;
  end if;
  return new;
end;
$function$;
create trigger team_answers_game_event after insert on public.team_answers
  for each row execute function public.game_events_on_team_answer();

-- Game start and the winner.
create or replace function public.game_events_on_room()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_team public.teams;
begin
  if new.phase = 'question' and old.phase = 'lobby' then
    insert into public.game_events (venue_id, room_id, kind, text)
      values (new.venue_id, new.id, 'started',
        'Game on! ' || (select count(*) from public.teams t where t.room_id = new.id
          and exists (select 1 from public.players pl where pl.team_id = t.id and pl.left_at is null)) || ' teams are playing');
  elsif new.phase = 'final' and old.phase = 'question' then
    select * into v_team from public.teams t where t.room_id = new.id order by t.score desc, t.created_at limit 1;
    if v_team.id is not null and v_team.score > 0 then
      insert into public.game_events (venue_id, room_id, kind, team_id, text)
        values (new.venue_id, new.id, 'winner', v_team.id, v_team.name || ' won with ' || to_char(v_team.score, 'FM999,999'));
    end if;
  end if;
  return new;
end;
$function$;
create trigger rooms_game_event after update of phase on public.rooms
  for each row when (new.phase is distinct from old.phase) execute function public.game_events_on_room();

-- Everything the carousel shows for a venue: what the live game is doing
-- right now, plus the last couple of hours of points, results and shoutouts.
create or replace function public.get_carousel(p_venue text)
returns json language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_venue public.venues;
begin
  v_venue := public.venue_by_slug(p_venue);
  if v_venue.id is null then
    return null;
  end if;
  return json_build_object(
    'now', now(),
    'venue', v_venue.name,
    'trivia', (select json_build_object('code', r.code, 'phase', r.phase, 'starts_at', r.starts_at,
        'question', r.current_question_index + 1,
        'total', (select count(*) from public.room_questions rq where rq.room_id = r.id),
        'teams', public.trivia_live_team_count(r.id),
        'players', (select count(*) from public.players pl where pl.room_id = r.id and pl.left_at is null))
      from public.rooms r where r.venue_id = v_venue.id and not r.retired and not r.queued
      order by r.created_at desc limit 1),
    'next_trivia', (select json_build_object('code', q.code, 'players', q.o_players)
      from (select o_code code, o_players from public.trivia_queue(v_venue.id) where not o_full limit 1) q),
    'feud', (select json_build_object('phase', f.phase, 'starts_at', f.starts_at)
      from public.feud_rooms f where f.venue_id = v_venue.id and not f.retired order by f.created_at desc limit 1),
    'bingo', (select json_build_object('phase', b.phase, 'starts_at', b.starts_at)
      from public.bingo_rooms b where b.venue_id = v_venue.id and not b.retired order by b.created_at desc limit 1),
    'items', (select coalesce(json_agg(x order by x.at desc), '[]') from (
        select e.id::text || 'e' id, e.game, e.kind, e.text, e.created_at at,
          (select ta.o_emoji from public.team_avatar(e.team_id) ta) emoji,
          (select ta.o_image_url from public.team_avatar(e.team_id) ta) image_url
        from public.game_events e
        where e.venue_id = v_venue.id and e.created_at > now() - interval '2 hours'
        union all
        select s.id::text || 's', 'trivia', 'shoutout', pl.nickname || ': ' || s.text, s.show_at, a.emoji, a.image_url
        from public.shoutouts s join public.players pl on pl.id = s.player_id
        left join public.avatars a on a.id = pl.avatar_id
        where s.venue_id = v_venue.id and not s.hidden and s.show_at <= now()
          and s.show_at > now() - interval '2 hours' and v_venue.shoutouts_enabled
        order by 5 desc limit 25
      ) x)
  );
end;
$function$;
grant execute on function public.get_carousel(text) to anon, authenticated;

-- Test bots pick a free avatar (stable per bot name) so feeds and rosters
-- look like real play while testing.
do $$
declare
  v_def text;
  v_old text := 'for b in select p.id, p.client_token, ro.id room_id, ro.category_options opts';
begin
  v_def := pg_get_functiondef('public.trivia_bot_autopilot()'::regprocedure);
  if position(v_old in v_def) = 0 then
    raise exception 'trivia_bot_autopilot() anchor not found';
  end if;
  v_def := replace(v_def, v_old,
    'update players p set avatar_id = (select a.id from avatars a where a.active and a.price_cents = 0 order by a.sort offset abs(hashtext(p.nickname)) % greatest(1, (select count(*) from avatars where active and price_cents = 0)) limit 1)
    where p.nickname like ''BOT %'' and p.avatar_id is null and p.left_at is null;
  ' || v_old);
  execute v_def;
end;
$$;
