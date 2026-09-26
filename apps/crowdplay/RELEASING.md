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

1. Ask for a change in Claude as usual. It is built and pushed to the
   `staging` branch, database changes go to the test database only, and
   dashboard changes go to the Test Room only.
2. Try it on crowdplay-staging.vercel.app and the Test Room.
3. Say **"ship it"**. Only then:
   - database changes are applied to the live database,
   - `staging` is merged into `main` (the live site rebuilds in ~1 minute),
   - the Control Room gets the same dashboard changes.

Nothing reaches the bar until step 3.

## Notes

- The test database has its own venue ("Test Bar (staging)", slug `main`)
  with test bots on. It has the same questions, avatars and shoutouts as live.
- The test database rests after 20 minutes idle like live does; opening
  any test game page wakes it up.
- Test-site purchases use their own secret (Vercel env `PURCHASE_SECRET`
  scoped to the `staging` branch) and never touch live revenue.
