# CrowdPlay launch checklist

Things that still need doing before real customers (and real money).

## Things to buy / sign up for
Prices are approximate; check when you sign up.

- [ ] **Domain for the main menu and QR codes** (Hostinger, about $10–20/year).
  One domain covers both: the main menu is the home page (e.g. `play.hivian.com`)
  and the QR codes point to that same address, so players never see "vercel".
  Buy the domain only, not a Hostinger hosting plan. Setup steps are below
  under "Connect your domain".
- [ ] **Vercel Pro** (about $20/month). The free plan is for non-commercial use
  only, so a business with paid avatars needs Pro. Upgrade the team that owns
  the crowdplay project.
- [ ] **Supabase Pro** (about $25/month, plus about $10/month to keep the test
  database running). Free projects can be paused when idle and have no daily
  backups; Pro keeps the live game always on, backed up, and allows more phones
  connected at once.
- [ ] **Outdoor ad board** (A-frame/sandwich board, about $60–150, plus printing).
  Put the venue's game QR code and "Free to play trivia inside" on it to pull in
  people walking by. Print it only after the domain is connected, so the QR code
  shows your domain. I can make the printable QR artwork.
- [ ] Square account (no monthly fee, about 2.9% + 30¢ per sale). Setup is under Payments below.
- [ ] Per bar: a TV device (Fire TV Stick/Chromecast about $30–50, or a mini-PC
  about $150) for the QR screen, and printed table QR codes (about $20–50).

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
- Remove the "Start new trivia game" testing button from the dashboard (restart_trivia_now). It is no longer on the player-facing /trivia page.
- Delete bot test check-ins/scans (@crowdplay-bots.test, bot-scan-*).
