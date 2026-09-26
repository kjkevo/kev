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
