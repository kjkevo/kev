# GA4 client reporting

A hosted, branded traffic report at `/report/[slug]` — sessions, users, top
channels, conversions, and top landing pages, with week-over-week % change on
each. Built to demo with sample data first, then reuse for real clients.

## How it fits together

```
GA4 Data API ──(weekly cron)──▶ Ga4Snapshot (Postgres) ──▶ /report/[slug] ──▶ email link
                scripts/ga4-pull.ts           │
                                               └── Ga4Client: branding + which property
```

- **`Ga4Client`** — one row per client: their `slug` (the report URL), GA4
  `propertyId`, and branding (`agencyName`, `brandColor`, `logoUrl`).
  `propertyId: null` means "sample data" — used by the demo client.
- **`Ga4Snapshot`** — one row per pull (weekly or monthly), storing the metrics
  plus the % change vs. the prior period, and channels/landing
  pages/conversion events as JSON. History across snapshots is what powers the
  trend chart.
- **`app/lib/ga4.ts`** — the GA4 Data API client + report queries.
- **`app/lib/ga4Pull.ts`** — pulls every active client with a `propertyId`,
  upserts a snapshot, and emails the report link if `recipientEmail` is set.
  Shared by the cron route and the manual script.
- **`app/report/[slug]/`** — the report page itself.

## 1. Try it now with sample data (no GA4 access needed)

```bash
npm run ga4:seed-demo
npm run dev
# open /report/demo
```

This seeds a "demo" client with 10 weeks of realistic (fake) traffic —
exactly what you'd show a prospect on a call, or record a Loom of, before you
have a single real client connected.

## 2. Connect a real client's GA4 property

1. **Google Cloud** — create/select a project, then enable the **Google
   Analytics Data API** (APIs & Services → Library).
2. **Service account** — IAM & Admin → Service Accounts → Create → Keys → Add
   key → JSON. Download it once; this is the only credential you need, and it
   works for every client (no per-client OAuth flow).
3. **Env var** — paste the JSON into `GA4_SERVICE_ACCOUNT_KEY` (raw or
   base64-encoded — either works; base64 avoids quoting issues in most host
   dashboards).
4. **Per client** — in their GA4 property: Admin → Property access management
   → Add users → the service account's email
   (`...@...iam.gserviceaccount.com`) → **Viewer** role. That's the client's
   entire "setup" — no login, no consent screen.
5. **Add the client**:
   ```bash
   npm run ga4:add-client -- \
     --slug=acme-plumbing \
     --name="Acme Plumbing Co" \
     --property=properties/123456789 \
     --agency="Your Agency Name" \
     --color="#FF6B00" \
     --email=owner@acmeplumbing.com
   ```
   (Find the GA4 property ID in GA4 Admin → Property Settings.)
6. **Pull their first report**:
   ```bash
   npm run ga4:pull
   ```
   Then visit `/report/acme-plumbing`.

## 3. Scheduling

`vercel.json` already runs `/api/cron/ga4-pull` every Monday at 07:00 UTC.
Set `CRON_SECRET` in production so only Vercel Cron can trigger it. Each
client's `deliverySchedule` (`weekly` or `monthly`, set via `--schedule` on
`ga4:add-client`) controls the length of the period it pulls — the cron itself
always runs weekly and just no-ops the metric window per client.

If `recipientEmail` is set on a client, they get an email with the report link
on every successful pull (see `sendGa4ReportEmail` in `app/lib/notifications.ts`).
Uses the same SMTP/Gmail config as the rest of the app — see the root
`.env.example`.

## 4. Branding per client

`agencyName`, `brandColor`, and `logoUrl` on `Ga4Client` reskin the report:
the accent color threads through the KPI tiles, trend line, and channel bars;
the logo (if set) appears next to "Powered by …" in the header. Update them
with `ga4:add-client` again (upserts by slug), or directly via Prisma Studio
(`npm run db:studio`).

## 5. What's NOT built (by design, for a fast demo → sale loop)

- No client-facing login — reports are unlisted (not indexed, `robots: noindex`)
  but reachable by anyone with the link. Fine for "here's your report" delivery;
  add real auth if a client needs it kept private.
- No PDF export — the hosted page is the deliverable (faster to build/iterate,
  and it's just as easy to screenshot or link).
- No Google Ads / Meta data yet — add a second `*Snapshot` model and section
  once a client asks for it specifically (see the original build plan: GA4
  first because its API approval is far faster to get than Google Ads').
