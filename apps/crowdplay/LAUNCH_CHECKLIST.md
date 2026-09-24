# CrowdPlay launch checklist

Things that still need doing before real customers (and real money).

## Turn on the Automatic Roller Coaster  ← do this first
While testing, games go to rest after 20 minutes with nobody playing (so the
bots and the live feed stop), and wake when someone opens a game page.
For launch, switch **Automatic Roller Coaster** on in the dashboard
(Venues, links and test bots) so games run around the clock.

## Payments (Square)
Purchases run in **test mode** until these are set. Test purchases show in the
dashboard marked TEST.

1. Create a Square account and open the Square Developer Dashboard
   (developer.squareup.com) → your application.
2. Copy these into Vercel → crowdplay project → Settings → Environment Variables:
   - `NEXT_PUBLIC_SQUARE_APPLICATION_ID` (Credentials page)
   - `NEXT_PUBLIC_SQUARE_LOCATION_ID` (Locations page)
   - `SQUARE_ACCESS_TOKEN` (Credentials page, mark it Sensitive)
   - `NEXT_PUBLIC_SQUARE_ENV` = `sandbox` to try Square's test cards first, then `production`
3. Redeploy (any push to main, or "Redeploy" in Vercel).
4. **Apple Pay**: in Square Developer Dashboard → Apple Pay, add the site's
   domain and download the verification file; it must be served at
   `/.well-known/apple-developer-merchantid-domain-association`
   (drop it in `apps/crowdplay/public/.well-known/`).
5. **Google Pay**: works through Square without extra setup for web.
6. Do one real $1 purchase and check it appears in the dashboard (not TEST)
   and in Square.

`PURCHASE_SECRET` is already set in Vercel and in the database
(`app_secrets.purchase_secret`); they must match.

## Avatars
- Done: 2 free characters (Jungle Scout, Crystal Titan) and 9 paid ones.

## Testing leftovers to switch off
- Turn off test bots for each venue (dashboard → Venues, links and test bots).
- Remove the "Start New Game" testing button on /trivia (restart_trivia_now).
- Delete bot test check-ins/scans (@crowdplay-bots.test, bot-scan-*).
