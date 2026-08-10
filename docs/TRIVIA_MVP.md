# Location-Gated Live Trivia — Phase 1 MVP

> Goal of v1: **prove the core loop works** — a patron sitting in a bar scans a
> QR code, joins a live trivia game on their phone, answers questions, and sees a
> shared leaderboard update in real time on a wall-mounted screen. Nothing more.

This document is the "on paper first" plan: the MVP feature set, what is
explicitly **out of scope**, the chosen game type, the data model, and the three
core screens.

---

## 1. First game type for MVP

**Decision: a single live trivia round.**

Why this over the alternatives (predictions, bingo, head-to-head, etc.):

- **Easiest to build** — a fixed bank of multiple-choice questions, a host who
  advances them, and per-player scoring. No external data feeds, no timing edge
  cases beyond "the question is open / the question is closed."
- **Easiest to demo** — walk a bar owner through it in 90 seconds: scan, pick an
  answer, watch your name climb the board.
- **Easiest to understand instantly** — everyone has played bar trivia. There is
  nothing to explain.

The whole product is designed so the *game type* is a field on a session
(`game_type`), leaving room for other formats later without reworking the venue,
player, or leaderboard plumbing.

---

## 2. MVP feature set (Phase 1 — what we ARE building)

1. **QR join flow.** Each venue has a stable QR token. Scanning it opens a join
   page for that venue's currently-live game. The patron enters a display name
   and is dropped into the game. Identity is a lightweight per-device id — **no
   accounts, no passwords, no email.**
2. **One live trivia game.** A host screen drives a single session through a
   fixed bank of multiple-choice questions: open a question, let players answer,
   reveal the answer, advance to the next.
3. **Real-time shared leaderboard.** A wall-mounted display that updates live as
   players score, powered by Supabase Realtime. This is the demo centerpiece.
4. **Cross-session history (lightweight).** Each time a player joins a game at a
   venue we bump their visit count and lifetime points (`venue_players`). This is
   the seed for streaks/regulars later; in v1 it's just recorded, not yet
   surfaced in a feature.
5. **Single venue.** One bar, one live game at a time. Multi-venue rows exist in
   the schema but the demo runs one venue.

---

## 3. Explicitly OUT of scope for v1

Written down so we don't scope-creep the MVP:

- ❌ **No sponsorships / ads / branded rounds.**
- ❌ **No bar-vs-bar** or any cross-venue competition.
- ❌ **No custom trivia content authoring.** Questions are a fixed seeded bank.
  No CMS, no per-venue question editor, no AI question generation.
- ❌ **No player accounts / auth.** Device-id identity only. No login, no email,
  no profile.
- ❌ **No prizes, payments, or payouts.**
- ❌ **No streak/regulars UI, no badges, no history screens.** We *record*
  `venue_players` data but don't yet build features on top of it.
- ❌ **No host authentication / roles.** The host screen is an unguarded URL for
  the demo. (First hardening item for v1.1.)
- ❌ **No true geofencing/GPS gating.** "Location-gated" in v1 means *possession
  of the venue's QR code*, which you only get by being in the venue. Real GPS/
  geofence verification is a later phase.
- ❌ **No moderation, profanity filter, or anti-cheat.** Trusted-room assumption.
- ❌ **No multi-game concurrency per venue, no scheduled games, no analytics.**

---

## 4. Venue data model

Core tables (as specced), plus the minimum the live loop actually needs
(`questions`, `answers`). Full DDL lives in
`supabase/migrations/0001_trivia_schema.sql`.

### `venues`
| column                 | type        | notes                                    |
|------------------------|-------------|------------------------------------------|
| `id`                   | uuid pk     |                                          |
| `name`                 | text        | "The Anchor Tavern"                      |
| `address`              | text        |                                          |
| `qr_token`             | text unique | opaque token embedded in the QR code     |
| `active_session_id`    | uuid → sessions | the game a scan should join (nullable) |
| `created_at`           | timestamptz |                                          |

### `sessions`
One live game. Carries the live game state so every client can render the same
thing off one row.
| column                  | type        | notes                                          |
|-------------------------|-------------|------------------------------------------------|
| `id`                    | uuid pk     |                                                |
| `venue_id`              | uuid → venues |                                              |
| `game_type`             | text        | default `live_trivia`                          |
| `phase`                 | text        | `lobby` \| `question` \| `reveal` \| `ended`   |
| `current_question_index`| int         | 0-based position in the bank                   |
| `current_question_id`   | uuid → questions | nullable                                  |
| `question_started_at`   | timestamptz | when the current question opened (for scoring) |
| `started_at`            | timestamptz | nullable                                       |
| `ended_at`              | timestamptz | nullable                                       |

### `players`
| column         | type        | notes                          |
|----------------|-------------|--------------------------------|
| `id`           | uuid pk     |                                |
| `display_name` | text        |                                |
| `device_id`    | text unique | generated + stored client-side |
| `created_at`   | timestamptz |                                |

### `session_players` (score for one game)
| column       | type   | notes                          |
|--------------|--------|--------------------------------|
| `session_id` | uuid   | → sessions                     |
| `player_id`  | uuid   | → players                      |
| `score`      | int    | default 0                      |
| `joined_at`  | timestamptz |                           |
| pk           | (`session_id`, `player_id`)   |         |

### `venue_players` (cross-session history for streaks)
| column         | type   | notes                        |
|----------------|--------|------------------------------|
| `venue_id`     | uuid   | → venues                     |
| `player_id`    | uuid   | → players                    |
| `visit_count`  | int    | default 1                    |
| `last_visit_at`| timestamptz |                         |
| `total_points` | int    | default 0                    |
| pk             | (`venue_id`, `player_id`)     |     |

### `questions` (fixed seeded bank — not authorable in v1)
| column          | type  | notes                                   |
|-----------------|-------|-----------------------------------------|
| `id`            | uuid pk |                                       |
| `prompt`        | text  |                                         |
| `choices`       | jsonb | array of choice strings (4)             |
| `correct_index` | int   | **server-only — never sent to players** |
| `category`      | text  |                                         |
| `sort_order`    | int   | play order                              |

### `answers` (one row per player per question; enforces one answer)
| column          | type  | notes                                    |
|-----------------|-------|------------------------------------------|
| `id`            | uuid pk |                                        |
| `session_id`    | uuid  | → sessions                               |
| `player_id`     | uuid  | → players                                |
| `question_id`   | uuid  | → questions                              |
| `choice_index`  | int   |                                          |
| `is_correct`    | bool  |                                          |
| `points_awarded`| int   |                                          |
| `answered_at`   | timestamptz |                                    |
| unique          | (`session_id`, `player_id`, `question_id`) | |

**Scoring rule (MVP):** correct answers earn `max(500, 1000 − 25×seconds)`,
where `seconds` is time since the question opened (capped at 20s). Wrong answers
earn 0. Points are awarded at answer time and immediately increment
`session_players.score` (so the leaderboard ticks up live) and
`venue_players.total_points`.

---

## 5. Security posture (MVP)

- The **browser** uses the Supabase **anon** key and can only **read** the tables
  needed to render the game (`venues`, `sessions`, `session_players`, `players`)
  and subscribe to their realtime changes. RLS enforces read-only.
- All **writes** (join, answer, host actions) go through **Next.js API routes**
  using the **service-role** key on the server. The anon client can never write.
- `questions.correct_index` is **never** exposed to the anon client. Question
  text/choices reach players through a server route that strips the answer until
  the session is in the `reveal` phase.

This is deliberately simple and safe enough to demo. Host-auth and geofencing are
the first items after the loop is proven.

---

## 6. The three screens

### Screen 1 — QR scan landing / join  (`/trivia/j/[qr_token]`)
- Resolves the venue from the QR token and finds its live session.
- "You're at **The Anchor Tavern** — Trivia Night is live."
- One input: **display name**. One button: **Join game**.
- If no game is live: friendly "no game running right now" state.
- On join → the mobile gameplay screen.

### Screen 2 — Mobile gameplay  (`/trivia/play/[sessionId]`)
- Lobby state before the game starts ("You're in — waiting for the host").
- When a question opens: the prompt + four big tap targets.
- After you tap: your choice locks, instant "correct / not this time" feedback.
- Reveal state highlights the right answer; then back to waiting for the next.
- Your running score always visible.

### Screen 3 — Wall-mounted leaderboard  (`/trivia/board/[sessionId]`)
- Big, glanceable, high-contrast for across-the-room viewing.
- Venue name + game status + current question number in the header.
- Live-sorted leaderboard of display name → score, re-ranking in real time as
  answers land. This is the "wow" of the demo.

### Supporting — Host controls  (`/trivia/host/[sessionId]`)
Not one of the three patron screens, but required to actually run the live game:
start the game, reveal the current answer, advance to the next question, end the
game. Unguarded URL in v1 (see out-of-scope).

---

## 7. Running the demo

See `docs/TRIVIA_SETUP.md` for the exact steps (create Supabase project, run the
two migrations, set env vars, open the host + board + a phone).
