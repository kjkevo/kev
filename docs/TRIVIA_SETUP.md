# Trivia MVP — Setup & Demo

This is the Phase 1 live-trivia feature. It lives under `/trivia/*` and is fully
self-contained — it does not touch the existing Slimpse app in this repo. It uses
Supabase directly (schema + Realtime), not Prisma.

## 1. Create a Supabase project

Any free-tier project at <https://supabase.com> works.

## 2. Run the migrations

In the Supabase dashboard → **SQL Editor**, run these two files in order:

1. `supabase/migrations/0001_trivia_schema.sql` — tables, RLS, realtime.
2. `supabase/migrations/0002_trivia_seed.sql` — demo venue + question bank.

(Or with the Supabase CLI: `supabase db push`.)

The seed creates a venue **The Anchor Tavern** with QR token `anchor-demo` and a
game in the lobby.

## 3. Set environment variables

Add these to `.env.local` (Supabase dashboard → **Project Settings → API**):

```bash
# Browser (safe to expose) — used by the realtime leaderboard/gameplay clients
NEXT_PUBLIC_SUPABASE_URL="https://<your-project>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon public key>"

# Server only (NEVER expose) — used by the /api/trivia/* routes to write
SUPABASE_SERVICE_ROLE_KEY="<service_role secret key>"
```

> `NEXT_PUBLIC_SUPABASE_URL` doubles as the server URL. The service-role key must
> stay server-side — it bypasses RLS.

## 4. Run it

```bash
npm install
npm run dev
```

Then open **`/trivia`** — the demo hub links to all three screens for the seeded
session.

## 5. Demo the core loop

1. **Big screen:** open the **Wall leaderboard** (`/trivia/board/<sessionId>`).
2. **Your phone(s):** open the **Player join** link (`/trivia/j/anchor-demo`),
   enter a name, join. Do this on a couple of devices/tabs.
3. **Host:** open **Host controls** (`/trivia/host/<sessionId>`). Tap
   **Start game** → answer on the phones → **Reveal answer** → **Next question**.
4. Watch the leaderboard re-rank in real time as answers land.
5. **Run it again** resets scores back to the lobby for another demo.

## Routes

| Route                         | Screen                                    |
|-------------------------------|-------------------------------------------|
| `/trivia`                     | Demo hub (links to the seeded session)    |
| `/trivia/j/[qr_token]`        | QR scan landing / join (Screen 1)         |
| `/trivia/play/[sessionId]`    | Mobile gameplay (Screen 2)                |
| `/trivia/board/[sessionId]`   | Wall leaderboard (Screen 3)               |
| `/trivia/host/[sessionId]`    | Host controls (drives the game)           |

## API routes (server-side writes, service role)

| Route                     | Purpose                                    |
|---------------------------|--------------------------------------------|
| `POST /api/trivia/join`   | Join a session; record player + venue visit |
| `GET  /api/trivia/question` | Current question (answer stripped until reveal) |
| `POST /api/trivia/answer` | Submit + score an answer                    |
| `POST /api/trivia/host`   | start / reveal / next / end / restart       |
