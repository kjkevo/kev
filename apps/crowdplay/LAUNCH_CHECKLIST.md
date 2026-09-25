# CrowdPlay launch checklist

Things that still need doing before real customers (and real money).

## Turn on the Automatic Roller Coaster  ← do this first
While testing, games go to rest after 20 minutes with nobody playing (so the
bots and the live feed stop), and wake when someone opens a game page.
For launch, switch **Automatic Roller Coaster** on in the dashboard
(Venues, links and test bots) so games run around the clock.

## Connect your domain (Hostinger)
Do this before printing any QR codes: the QR codes contain the site address,
so codes printed while it's still crowdplay-psi.vercel.app would stop working
if that address ever changes.

1. Buy/choose the domain in Hostinger (e.g. hivian.com, or play.hivian.com).
2. In Vercel → crowdplay project → Settings → Domains, add the domain.
   Vercel shows the DNS records to create.
3. In Hostinger → Domains → DNS / Nameservers, add those records
   (usually an A record `@ → 76.76.21.21` and a CNAME `www → cname.vercel-dns.com`,
   but copy exactly what Vercel shows). HTTPS is set up automatically.
4. Make the new domain the primary one in Vercel so old links redirect.
5. Open /qr on the new domain and check the QR codes point there, then
   print them. Redo the Apple Pay domain verification (Payments below) for
   the new domain.

Note: the game itself keeps running on Vercel. Hostinger's regular web
hosting can't run this app (it needs Node.js servers and the always-on
game clock), so Hostinger is used for the domain name, pointed at Vercel.
If you want to move the hosting itself to Hostinger, that needs their VPS
plan, and I'd set that up with you.


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
