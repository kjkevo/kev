# CrowdPlay: working rules

Read RELEASING.md first. Two separate copies exist: live and test.

- Build every change for the **test** copy first:
  - code → push/merge to the `staging` branch (never `main`),
  - database changes → Supabase project `xtvwtcphmecgvqtnfoak` (crowdplay-staging) only,
  - dashboard changes → the Test Room artifact only.
- Only when the owner says **"ship it"**:
  - apply the same database migrations to `cgkstbqwzsvmvgsffswy` (live),
  - merge `staging` into `main`,
  - copy the dashboard changes into the Control Room (keep its PROJECT id pointing at live).
- Keep migrations in `supabase/migrations/` numbered in order; each one must be
  applied to both databases (test first, live on ship).
