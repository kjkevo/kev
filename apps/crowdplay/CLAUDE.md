# CrowdPlay: working rules

Read RELEASING.md for the two copies (live and test) and their links.

**Default: changes go straight to LIVE** (no venue is using it yet):
code → `main`, database → `cgkstbqwzsvmvgsffswy`, dashboard → Control Room.

**Test area only when the owner asks** ("in the test area", "test this first",
"on staging", or similar). Then:
1. First bring the test copy up to date with live (it is not kept in sync
   between uses, to save effort):
   - merge `main` into `staging`,
   - apply any migrations in `supabase/migrations/` that the test database
     (`xtvwtcphmecgvqtnfoak`) is missing (compare with `list_migrations`),
   - refresh the Test Room from the Control Room (same file, PROJECT id =
     `xtvwtcphmecgvqtnfoak`, pink Test badge).
2. Make the change on the test copy only: `staging` branch, test database, Test Room.
3. On **"ship it"**: apply the same migrations to live, merge `staging` into
   `main`, copy dashboard changes into the Control Room (PROJECT id stays live).

Keep migrations in `supabase/migrations/` numbered in order.

**No emojis anywhere in the game** (the owner's standing rule): no emoji in
UI text, labels, notifications, perks or database strings. Use the line
icons in `src/components/Icon.tsx` or plain words instead.

**Write for a 5th grader** (the owner's standing rule): short, simple words in
big text. No small print or long explanations on game screens; a power or
perk gets a 2-5 word description ("Mark any square", "+10 seconds").

**Keep Wild Match and Drop Line far from UNO and Connect 4** (to avoid a
takedown): no matching colors, card layouts, piece shapes, card names or logos.
Wild Match cards are dark with a colored edge and a symbol per color (Pink
star, Purple crown, Teal bolt, Orange flame; silver "Pick" and "Take 4"), and
the actions are Block, Flip, Take 2. Drop Line uses square Lime and Pink tiles
on a dark slate board. Never use red/yellow/green/blue card sets, white-bordered
solid cards, "Skip", "Reverse", "Draw Two", "Wild Draw Four", round red and
yellow discs, or a blue grid.

## Setting up a bar from the Bar Pitch Profile

The owner fills in the "Bar Pitch Profile" page (claude.ai/artifact/1y4RdtSGhUiUFXk5pgwR4Z)
before visiting a bar; each submission is a `bars/<slug>` document in that page's
database (`status: "submitted"`). When asked to "set up <bar>":
1. Read the document (ArtifactData get, collection `bars`).
2. If it has `logoAssetId`, fetch it with the Artifact tool (`action: "read"`,
   `path: <asset id>`), save it as `public/venues/<slug>.<ext>`, commit and merge,
   and use `/venues/<slug>.<ext>` as the logo URL.
3. Run `select * from public.apply_venue_profile('<json>'::jsonb)` with
   `{slug, name, timezone, logo_url, accent, welcome, prize,
     questions: [{prompt, answer, wrong, accept, fun_fact}]}` (map `funFact` to
   `fun_fact`). It creates/updates the venue and replaces its House pack.
4. Update the document: `status: "live"`,
   `liveUrl: "https://slimpse.vercel.app/?venue=<slug>"`.
5. Give the owner the bar's **TV setup link** (open it once on the bar's TV
   or computer to pair it; only paired screens show the check-in code):
   `https://slimpse.vercel.app/?venue=<slug>&pair=<screen_secret>` (main menu)
   or `https://slimpse.vercel.app/screen?venue=<slug>&pair=<screen_secret>`
   (Trivia screen). Get it with `select screen_secret from venues where slug = '<slug>'`.

## Play only at the bar (migration 0123)

Joining any game needs a check-in from scanning a paired TV's code (changes
daily at noon, bar time); 20 minutes idle ends it. The owner tests from
anywhere with `https://slimpse.vercel.app/in?v=main&c=<owner code>`, where the
code is `select value from app_secrets where name = 'owner_pass_code'`. Never
put that code or a screen secret in the repo.

When asked to "end the pitch" for a bar: `select * from public.end_venue_pitch('<slug>')`,
then set its document's `status: "ended"`. Its link falls back to the normal game;
setting it up again brings it back.

## Before launch: open blockers (remind the owner)

Before any launch, real-money payments, bar pitch going live, or other major
step, remind the owner of these unfinished items first:

1. **Sign-in emails don't send yet, so nobody can sign in or buy a character.**
   Buying requires sign-in (migration 0121). The owner has **no domain yet**.
   Needed: buy a domain (e.g. slimpse.com) -> free Resend account, add the
   domain's DNS records, create an API key -> in Supabase: Auth > SMTP
   (smtp.resend.com, port 465, user `resend`, password = API key, sender
   no-reply@domain) -> Auth > Email Templates > Magic Link must include
   `{{ .Token }}` (body: "Your Slimpse code is {{ .Token }}. Or tap here to
   sign in: {{ .ConfirmationURL }}") -> Auth > URL Configuration: Site URL
   https://slimpse.vercel.app, redirect https://slimpse.vercel.app/**.
   Then test sign-in and a test-mode purchase end to end.
2. Payments are still in test mode (Square keys not set).
3. **Confirm live table updates reach phones** (migration 0125). During a
   real test game, `select topic, inserted_at from realtime.messages order by
   inserted_at desc limit 5` should show `dl:`/`wm:`/`sb:` rows. If it's empty,
   Supabase hasn't made today's `realtime.messages_YYYY_MM_DD` slot (it does
   this itself once phones connect); phones then fall back to checking every
   3 seconds, which works but costs more. Check Realtime is enabled with
   public channels allowed in the Supabase dashboard.
4. **Outside monitor for the game clocks** (migration 0126): an uptime
   monitor must check https://slimpse.vercel.app/api/health every minute and
   alert the owner when it isn't 200 (it returns 503 with the problems when a
   game clock stops, the watchdog goes quiet, or a game is frozen). Confirm
   it's set up and that a test alert reached the owner's phone.

## Later: game timing in its own service

All game clocks (sb-tick, wm-tick, dl-tick, trivia/feud ticks) run as
1-second pg_cron jobs inside the one database. When the owner is ready to
scale, move turn timers and bot moves into a separate always-on worker (for
example a small Node service on Fly.io or Railway, or Supabase Edge Functions
on a schedule) that calls the same *_tick functions, keeps pg_cron as a
backup, and reports to /api/health.
