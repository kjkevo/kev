-- ============================================================================
-- Location-Gated Live Trivia — Phase 1 schema
-- ----------------------------------------------------------------------------
-- Core tables (venues, sessions, players, session_players, venue_players)
-- plus the minimum the live loop needs (questions, answers).
--
-- Security model (see docs/TRIVIA_MVP.md §5):
--   * anon (browser) may only SELECT venues / sessions / session_players /
--     players, and subscribe to realtime on sessions + session_players.
--   * All writes go through Next.js API routes using the service-role key,
--     which bypasses RLS.
--   * questions.correct_index is never readable by anon.
-- ============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ── venues ──────────────────────────────────────────────────────────────────
create table if not exists public.venues (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  address            text,
  qr_token           text not null unique,
  active_session_id  uuid,                       -- FK added after sessions exists
  created_at         timestamptz not null default now()
);

-- ── sessions ────────────────────────────────────────────────────────────────
-- One live game. Holds the shared game state so every client renders off one row.
create table if not exists public.sessions (
  id                      uuid primary key default gen_random_uuid(),
  venue_id                uuid not null references public.venues(id) on delete cascade,
  game_type               text not null default 'live_trivia',
  phase                   text not null default 'lobby'
                            check (phase in ('lobby','question','reveal','ended')),
  current_question_index  int  not null default 0,
  current_question_id     uuid,                   -- FK added after questions exists
  question_started_at     timestamptz,
  started_at              timestamptz,
  ended_at                timestamptz,
  created_at              timestamptz not null default now()
);

create index if not exists sessions_venue_id_idx on public.sessions(venue_id);

alter table public.venues
  add constraint venues_active_session_fk
  foreign key (active_session_id) references public.sessions(id) on delete set null;

-- ── players ─────────────────────────────────────────────────────────────────
create table if not exists public.players (
  id            uuid primary key default gen_random_uuid(),
  display_name  text not null,
  device_id     text not null unique,
  created_at    timestamptz not null default now()
);

-- ── session_players (score for one game) ────────────────────────────────────
create table if not exists public.session_players (
  session_id  uuid not null references public.sessions(id) on delete cascade,
  player_id   uuid not null references public.players(id)  on delete cascade,
  score       int  not null default 0,
  joined_at   timestamptz not null default now(),
  primary key (session_id, player_id)
);

create index if not exists session_players_session_idx on public.session_players(session_id);

-- ── venue_players (cross-session history for streaks) ───────────────────────
create table if not exists public.venue_players (
  venue_id       uuid not null references public.venues(id)  on delete cascade,
  player_id      uuid not null references public.players(id) on delete cascade,
  visit_count    int  not null default 1,
  last_visit_at  timestamptz not null default now(),
  total_points   int  not null default 0,
  primary key (venue_id, player_id)
);

-- ── questions (fixed seeded bank; not authorable in v1) ─────────────────────
create table if not exists public.questions (
  id             uuid primary key default gen_random_uuid(),
  prompt         text not null,
  choices        jsonb not null,          -- array of choice strings
  correct_index  int  not null,           -- SERVER ONLY — never sent to anon
  category       text,
  sort_order     int  not null default 0
);

alter table public.sessions
  add constraint sessions_current_question_fk
  foreign key (current_question_id) references public.questions(id) on delete set null;

-- ── answers (one per player per question) ───────────────────────────────────
create table if not exists public.answers (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.sessions(id)  on delete cascade,
  player_id       uuid not null references public.players(id)   on delete cascade,
  question_id     uuid not null references public.questions(id) on delete cascade,
  choice_index    int  not null,
  is_correct      boolean not null,
  points_awarded  int  not null default 0,
  answered_at     timestamptz not null default now(),
  unique (session_id, player_id, question_id)
);

create index if not exists answers_session_idx on public.answers(session_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.venues          enable row level security;
alter table public.sessions        enable row level security;
alter table public.players         enable row level security;
alter table public.session_players enable row level security;
alter table public.venue_players   enable row level security;
alter table public.questions       enable row level security;
alter table public.answers         enable row level security;

-- anon/auth may READ the tables needed to render the game. No write policies
-- exist, so the anon key cannot insert/update/delete. The service-role key used
-- by the API routes bypasses RLS entirely.
drop policy if exists "public read venues"          on public.venues;
drop policy if exists "public read sessions"        on public.sessions;
drop policy if exists "public read players"         on public.players;
drop policy if exists "public read session_players" on public.session_players;

create policy "public read venues"
  on public.venues for select using (true);
create policy "public read sessions"
  on public.sessions for select using (true);
create policy "public read players"
  on public.players for select using (true);
create policy "public read session_players"
  on public.session_players for select using (true);

-- questions, venue_players, answers: no anon policies → anon fully denied.
-- (questions reach players only through a server route that strips the answer.)

-- ============================================================================
-- Realtime — clients subscribe to game-state and score changes.
-- ============================================================================
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.session_players;
