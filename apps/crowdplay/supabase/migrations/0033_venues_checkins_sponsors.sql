-- Venues, guest check-ins, TV screen heartbeats, QR scans, a client error
-- log, and sponsors with proof-of-play -- the data behind the four-layer
-- ops dashboard (system health, live activity, business numbers, sponsor
-- accountability).
--
-- Everything is written through narrow SECURITY DEFINER functions granted to
-- anon (the phone and TV pages have no login); none of the tables are
-- readable by anon. The owner reads them through the Supabase connector.
--
-- "Tonight" for a venue runs from noon to noon in the venue's own time zone,
-- so a check-in at 1am still counts toward the night it belongs to.

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  name text not null check (length(trim(name)) between 1 and 80),
  timezone text not null default 'America/New_York',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.venues (slug, name) values ('main', 'Main venue');

-- One row per physical TV (a random key the TV keeps in its own storage).
create table public.venue_screens (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  screen_key text not null,
  page text,
  user_agent text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (venue_id, screen_key)
);

-- A guest is one phone number or email, across every venue.
create table public.guests (
  id uuid primary key default gen_random_uuid(),
  contact_key text not null unique,
  name text not null,
  contact text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  night_start timestamptz not null,
  is_returning boolean not null,
  created_at timestamptz not null default now(),
  unique (venue_id, guest_id, night_start)
);
create index checkins_venue_time on public.checkins (venue_id, created_at desc);

-- A scan is one browser session opening a venue's check-in link.
create table public.qr_scans (
  id bigserial primary key,
  venue_id uuid not null references public.venues(id) on delete cascade,
  session_key text not null,
  created_at timestamptz not null default now(),
  unique (venue_id, session_key)
);
create index qr_scans_venue_time on public.qr_scans (venue_id, created_at desc);

-- Failed saves and crashes reported by phones and TVs (kept 30 days).
create table public.client_errors (
  id bigserial primary key,
  venue_id uuid references public.venues(id) on delete set null,
  source text not null check (source in ('checkin', 'screen', 'ads', 'game')),
  message text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index client_errors_time on public.client_errors (created_at desc);

create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  slot_type text not null check (slot_type in ('screen_loop', 'round', 'title', 'prize')),
  is_founding boolean not null default false,
  trial_ends_on date,
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  headline text not null check (length(trim(headline)) between 1 and 80),
  tagline text check (tagline is null or length(tagline) <= 140),
  accent text not null default '#fbbf24' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  notes text,
  created_at timestamptz not null default now()
);

-- Proof of play: one row each time a TV finished showing a sponsor's ad.
create table public.ad_plays (
  id bigserial primary key,
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  screen_id uuid not null references public.venue_screens(id) on delete cascade,
  seconds int not null,
  played_at timestamptz not null default now()
);
create index ad_plays_sponsor_time on public.ad_plays (sponsor_id, played_at desc);

alter table public.venues enable row level security;
alter table public.venue_screens enable row level security;
alter table public.guests enable row level security;
alter table public.checkins enable row level security;
alter table public.qr_scans enable row level security;
alter table public.client_errors enable row level security;
alter table public.sponsors enable row level security;
alter table public.ad_plays enable row level security;

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
-- Noon-to-noon "night" a moment belongs to, in the venue's time zone.
create or replace function public.venue_night_start(p_tz text, p_at timestamptz default now())
returns timestamptz language sql stable as $function$
  select (date_trunc('day', (p_at at time zone p_tz) - interval '12 hours') + interval '12 hours') at time zone p_tz;
$function$;

create or replace function public.venue_by_slug(p_slug text)
returns public.venues language sql stable security definer set search_path to 'public' as $function$
  select * from public.venues where slug = lower(trim(p_slug)) and active;
$function$;

-- ---------------------------------------------------------------------
-- Public (anon) entry points
-- ---------------------------------------------------------------------
create or replace function public.log_qr_scan(p_venue text, p_session_key text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v public.venues;
begin
  v := public.venue_by_slug(p_venue);
  if v.id is null or length(coalesce(p_session_key, '')) not between 8 and 64 then
    return;
  end if;
  insert into public.qr_scans (venue_id, session_key) values (v.id, p_session_key)
    on conflict (venue_id, session_key) do nothing;
end;
$function$;

create or replace function public.checkin_submit(p_venue text, p_name text, p_contact text)
returns table(o_checkin_id uuid, o_returning boolean, o_already boolean)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v public.venues;
  v_contact text := trim(coalesce(p_contact, ''));
  v_key text;
  v_guest public.guests;
  v_night timestamptz;
  v_returning boolean;
  v_existing uuid;
  v_id uuid;
begin
  v := public.venue_by_slug(p_venue);
  if v.id is null then
    raise exception 'VENUE_NOT_FOUND';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 60 then
    raise exception 'INVALID_NAME';
  end if;
  if v_contact ~ '@' then
    if v_contact !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_contact) > 120 then
      raise exception 'INVALID_CONTACT';
    end if;
    v_key := 'e:' || lower(v_contact);
  else
    v_key := regexp_replace(v_contact, '[^0-9]', '', 'g');
    if length(v_key) = 11 and left(v_key, 1) = '1' then
      v_key := substr(v_key, 2);
    end if;
    if length(v_key) not between 7 and 15 then
      raise exception 'INVALID_CONTACT';
    end if;
    v_key := 'p:' || v_key;
  end if;

  v_night := public.venue_night_start(v.timezone);

  insert into public.guests (contact_key, name, contact) values (v_key, trim(p_name), v_contact)
    on conflict (contact_key) do update set name = excluded.name, last_seen_at = now()
    returning * into v_guest;

  select c.id into v_existing from public.checkins c
    where c.venue_id = v.id and c.guest_id = v_guest.id and c.night_start = v_night;
  if v_existing is not null then
    return query select v_existing, (select c.is_returning from public.checkins c where c.id = v_existing), true;
    return;
  end if;

  v_returning := exists (select 1 from public.checkins c where c.guest_id = v_guest.id and c.night_start < v_night);
  insert into public.checkins (venue_id, guest_id, night_start, is_returning)
    values (v.id, v_guest.id, v_night, v_returning)
    returning id into v_id;
  return query select v_id, v_returning, false;
end;
$function$;

create or replace function public.log_client_error(p_venue text, p_source text, p_message text, p_detail jsonb default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v public.venues;
begin
  if p_source not in ('checkin', 'screen', 'ads', 'game') then
    return;
  end if;
  v := public.venue_by_slug(p_venue);
  -- A flood from one source is one problem; keep the log readable.
  if (select count(*) from public.client_errors where created_at > now() - interval '1 minute') >= 60 then
    return;
  end if;
  insert into public.client_errors (venue_id, source, message, detail)
    values (v.id, p_source, left(coalesce(p_message, 'unknown error'), 300),
            case when p_detail is null or length(p_detail::text) > 2000 then null else p_detail end);
end;
$function$;

create or replace function public.screen_heartbeat(p_venue text, p_screen_key text, p_page text, p_user_agent text default null)
returns table(o_screen_id uuid, o_venue_name text)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v public.venues;
  v_id uuid;
begin
  v := public.venue_by_slug(p_venue);
  if v.id is null then
    raise exception 'VENUE_NOT_FOUND';
  end if;
  if length(coalesce(p_screen_key, '')) not between 8 and 64 then
    raise exception 'INVALID_SCREEN';
  end if;
  insert into public.venue_screens (venue_id, screen_key, page, user_agent)
    values (v.id, p_screen_key, left(p_page, 80), left(p_user_agent, 200))
  on conflict (venue_id, screen_key) do update set
    last_seen_at = now(), page = excluded.page, user_agent = excluded.user_agent
  returning id into v_id;
  return query select v_id, v.name;
end;
$function$;

create or replace function public.get_screen_ads(p_venue text)
returns table(o_sponsor_id uuid, o_name text, o_headline text, o_tagline text, o_accent text, o_slot_type text)
language sql stable security definer set search_path to 'public' as $function$
  select s.id, s.name, s.headline, s.tagline, s.accent, s.slot_type
  from public.sponsors s join public.venues v on v.id = s.venue_id
  where v.slug = lower(trim(p_venue)) and v.active and s.status = 'active'
  order by s.created_at;
$function$;

-- Only a TV that has checked in within the last 2 minutes can log a play,
-- and the same TV can't log the same sponsor twice within 10 seconds.
create or replace function public.log_ad_play(p_venue text, p_screen_key text, p_sponsor_id uuid, p_seconds int)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v public.venues;
  v_screen uuid;
begin
  v := public.venue_by_slug(p_venue);
  if v.id is null or p_seconds not between 3 and 120 then
    return;
  end if;
  select id into v_screen from public.venue_screens
    where venue_id = v.id and screen_key = p_screen_key and last_seen_at > now() - interval '2 minutes';
  if v_screen is null then
    return;
  end if;
  if not exists (select 1 from public.sponsors where id = p_sponsor_id and venue_id = v.id and status = 'active') then
    return;
  end if;
  if exists (select 1 from public.ad_plays where screen_id = v_screen and sponsor_id = p_sponsor_id
             and played_at > now() - interval '10 seconds') then
    return;
  end if;
  insert into public.ad_plays (sponsor_id, venue_id, screen_id, seconds) values (p_sponsor_id, v.id, v_screen, p_seconds);
end;
$function$;

revoke execute on function public.venue_by_slug(text) from anon, authenticated, public;
grant execute on function public.log_qr_scan(text, text) to anon, authenticated;
grant execute on function public.checkin_submit(text, text, text) to anon, authenticated;
grant execute on function public.log_client_error(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.screen_heartbeat(text, text, text, text) to anon, authenticated;
grant execute on function public.get_screen_ads(text) to anon, authenticated;
grant execute on function public.log_ad_play(text, text, uuid, int) to anon, authenticated;
