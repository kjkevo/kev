# Test site vs live site

There are two complete copies of CrowdPlay. They never share data.

| | Live (the bar) | Test |
|---|---|---|
| Game site | crowdplay-psi.vercel.app | crowdplay-staging.vercel.app (pink "Test site" tag) |
| QR screen | crowdplay-psi.vercel.app/qr | crowdplay-staging.vercel.app/qr |
| TV screen | crowdplay-psi.vercel.app/screen | crowdplay-staging.vercel.app/screen |
| Dashboard | Control Room: claude.ai/artifact/2LSNrQXS6c5kKZ8kFM3yqV | Test Room: claude.ai/artifact/RyoZh9RFG5jPJ2eTESiZhd |
| Database (Supabase) | `crowdplay` (cgkstbqwzsvmvgsffswy) | `crowdplay-staging` (xtvwtcphmecgvqtnfoak) |
| Git branch | `main` | `staging` |

A QR code shown on the test site points at the test site, so scanning it
from a phone lands in the test game, never the live one.

## How a change flows

**Normally, changes go straight to live** (game, QR screen, Control Room).

**To try something in the test area first**, say so ("do this in the test
area", "test this first"). Then:

1. The test copy is first brought up to date with live (it isn't kept in
   sync between uses).
2. The change goes to the test copy only: crowdplay-staging.vercel.app,
   the test database and the Test Room.
3. Say **"ship it"** to copy it to live. Until then nothing reaches the bar.

## Notes

- The test database has its own venue ("Test Bar (staging)", slug `main`)
  with test bots on. It has the same questions, avatars and shoutouts as live.
- The test database rests after 20 minutes idle like live does; opening
  any test game page wakes it up.
- Test-site purchases use their own secret (Vercel env `PURCHASE_SECRET`
  scoped to the `staging` branch) and never touch live revenue.
