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

When asked to "end the pitch" for a bar: `select * from public.end_venue_pitch('<slug>')`,
then set its document's `status: "ended"`. Its link falls back to the normal game;
setting it up again brings it back.
