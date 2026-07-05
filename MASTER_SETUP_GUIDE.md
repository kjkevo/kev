# Complete Setup Guide - Master Document

Everything you need to get your appointment reminder system live. Read this first.

---

## What You're Building

An **appointment reminder automation system** that:

✅ Receives appointments from Calendly/Cal.com/forms  
✅ Sends instant confirmation texts  
✅ Sends automatic reminders (24h & 2h before)  
✅ Sends no-show follow-ups with rebook links  
✅ Manages waitlists (notifies when slots open)  
✅ Supports multiple clients with different names/messages/timezones  
✅ Stores data in Google Sheets (free, no database needed)  
✅ Runs 24/7 on cheap hosting (~$27/month)  

---

## Document Map

**Start here, in this order:**

1. **`SETUP_CHECKLIST.md`** ← **START HERE** (quick reference)
2. **`EXTERNAL_SERVICES_SETUP.md`** ← Detailed step-by-step for each service
3. **`HOW_TO_VERIFY.md`** ← Proves everything is working
4. **`PROOF_OF_CONCEPT.md`** ← Full end-to-end testing guide
5. **`CONFIGURATION_TESTING_GUIDE.md`** ← Test timezone/config (critical!)

---

## Quick Start (2 Hours)

### What You Need Upfront

Gather these before starting:

```
✓ Email address (for Twilio, Google, Vercel accounts)
✓ Phone number (for Twilio verification)
✓ GitHub account (for code)
✓ Booking tool (Calendly, Cal.com, or Google Forms)
```

### The 5 Accounts to Create

| # | Service | Time | Cost | Why |
|---|---------|------|------|-----|
| 1 | **Twilio** | 5 min | Free ($15 credit) | Send SMS texts |
| 2 | **Google Sheets** | 10 min | Free | Store appointments |
| 3 | **Booking Tool** | 5 min | Free | Receive appointments |
| 4 | **Vercel** | 10 min | $20/mo | Host API |
| 5 | **Railway** | 10 min | $7/mo | Run reminders 24/7 |

**Total time: ~1 hour to set up**  
**Total cost: ~$27/month to run**

---

## Step-by-Step Path

### Phase 1: Twilio (15 min)

```bash
1. Go to https://twilio.com/console
2. Sign up
3. Buy phone number ($1/mo)
4. Copy 3 credentials:
   - Account SID
   - Auth Token
   - Phone Number
5. Test by sending yourself SMS
```

**Save these in notepad:**
```
TWILIO_ACCOUNT_SID = AC...
TWILIO_AUTH_TOKEN = ...
TWILIO_PHONE_NUMBER = +1...
```

See: `EXTERNAL_SERVICES_SETUP.md` → Part 1

---

### Phase 2: Google Sheets (20 min)

```bash
1. Go to https://console.cloud.google.com
2. Create project
3. Enable Google Sheets API
4. Create service account
5. Download JSON key
6. Create Google Sheet
7. Share with service account email
```

**Save these in notepad:**
```
GOOGLE_SHEETS_SPREADSHEET_ID = 1ABC...
GOOGLE_SHEETS_PRIVATE_KEY = -----BEGIN...
GOOGLE_SHEETS_CLIENT_EMAIL = appointment-reminders@...
```

See: `EXTERNAL_SERVICES_SETUP.md` → Part 2

---

### Phase 3: Booking Tool (15 min)

Choose ONE:

**A) Calendly** (most popular)
- Sign up at https://calendly.com
- Settings → Integrations → Add Webhook
- Endpoint: (leave blank, update later)
- Event: "Invitee scheduled"

**B) Cal.com** (open source)
- Sign up at https://cal.com
- Settings → Integrations → Add Webhook
- Endpoint: (leave blank, update later)
- Event: "Booking created"

**C) Your Form + Zapier** (most flexible)
- Create form (Google Forms, Typeform, etc)
- Create Zapier Zap: Form → Webhooks
- Map fields: Name, Phone, DateTime, Service Type
- Endpoint: (leave blank, update later)

See: `EXTERNAL_SERVICES_SETUP.md` → Part 3

---

### Phase 4: Hosting (30 min)

**Option A: Vercel + Railway** (Recommended)

**Vercel** (API):
```bash
1. Go to https://vercel.com
2. Sign up with GitHub
3. Import your repo
4. Add 6 environment variables (all your credentials)
5. Deploy
6. Get URL: https://your-app.vercel.app
7. Update booking tool webhook to this URL
```

**Railway** (Reminders):
```bash
1. Go to https://railway.app
2. Create account
3. Deploy same repo
4. Add same environment variables
5. Service runs 24/7 automatically
```

**Option B: Render** (Cheaper)
```bash
1. Create Dockerfile (provided)
2. Deploy to https://render.com (same as Vercel)
3. Cost: ~$7/mo instead of $20
```

See: `EXTERNAL_SERVICES_SETUP.md` → Part 4

---

### Phase 5: Configuration (10 min)

**Local setup:**

```bash
# 1. Create .env.local
cp .env.example .env.local

# 2. Add all your credentials
# TWILIO_*, GOOGLE_SHEETS_*, APPOINTMENT_WEBHOOK_SECRET

# 3. Configure your business
# Edit config/clients.ts:
# - businessName: "Your Business"
# - businessPhone: "+1234567890"
# - timezone: "America/New_York"
# - Customize SMS messages

# 4. Test locally
npm install
npm run dev
npm run reminders:dev
```

See: `EXTERNAL_SERVICES_SETUP.md` → Part 5

---

### Phase 6: Testing (20 min)

**Make sure it works before going live:**

```bash
# Run automated test
./test-all-features.sh

# Watch for [SMS MOCK] messages in console
# Verify SMS shows:
# ✅ Correct business name
# ✅ Correct timezone
# ✅ Correct phone number
```

See: `HOW_TO_VERIFY.md` and `PROOF_OF_CONCEPT.md`

---

### Phase 7: Go Live! (5 min)

Update booking tool webhook URL:

```bash
# Change from: http://localhost:3000/api/webhooks/appointments
# To: https://your-vercel-domain.com/api/webhooks/appointments
```

**Your system is now live!** 🚀

---

## Cost Breakdown

| Component | Cost | Notes |
|-----------|------|-------|
| **Twilio** | $1/mo + SMS | ~$0.0075 per SMS (~$10-30/mo for 100+ appts) |
| **Google Sheets** | Free | Unlimited storage, no database |
| **Vercel** | $20/mo | Next.js hosting (Pro plan) |
| **Railway** | $7/mo | Reminder service 24/7 |
| **Domain** | $0-15/yr | Optional (use Vercel subdomain) |
| **Total** | **$28-50/mo** | Supports 1000s of customers |

**Selling price**: $99-199/month per client = **3-7x ROI** 💰

---

## Before You Start: Pre-Flight Checklist

- [ ] You have a GitHub account with this code
- [ ] You have the `claude/appointment-reminder-automation-40llj9` branch locally
- [ ] You understand what the system does (re-read intro above)
- [ ] You have 2 hours of focused time
- [ ] You have credentials from: Twilio, Google Cloud, booking tool
- [ ] Your booking tool is ready (Calendly, Cal.com, or form)

---

## During Setup: Key Points

**Don't Skip These:**

1. **JSON Key Security**: Never commit `.env.local` to GitHub
   ```
   # Add to .gitignore:
   .env.local
   ```

2. **Webhook Secret**: Generate a random secret
   ```bash
   # Generate with:
   openssl rand -hex 32
   ```

3. **Google Sheets Sharing**: CRITICAL - share with service account email!
   ```
   ✅ Shared with: appointment-reminders@...
   ✅ Role: Editor
   ```

4. **Timezone Accuracy**: Most common bug
   ```
   ✅ Client config has correct timezone
   ✅ All times use moment().tz(timezone)
   ✅ Test with CONFIGURATION_TESTING_GUIDE.md
   ```

5. **Reminder Service**: Needs to run 24/7
   ```
   ✅ Railway/Render/Heroku for continuous uptime
   ✅ NOT Vercel (serverless, no 24/7 processes)
   ```

---

## Verification Checklist

**After setup, verify:**

```
ACCOUNTS CREATED
☑ Twilio (SMS sending)
☑ Google Sheets (data storage)
☑ Booking tool (Calendly/Cal.com/form)
☑ Vercel (API hosting)
☑ Railway (reminder service)

CREDENTIALS IN .env.local
☑ TWILIO_ACCOUNT_SID
☑ TWILIO_AUTH_TOKEN
☑ TWILIO_PHONE_NUMBER
☑ GOOGLE_SHEETS_SPREADSHEET_ID
☑ GOOGLE_SHEETS_PRIVATE_KEY
☑ GOOGLE_SHEETS_CLIENT_EMAIL
☑ APPOINTMENT_WEBHOOK_SECRET

SYSTEM WORKING
☑ Create test appointment
☑ Receive confirmation SMS ✅
☑ SMS has correct business name
☑ SMS has correct timezone
☑ Appointment in Google Sheets
☑ Reminders fire at correct times
☑ No-show follow-up works
☑ Waitlist logic works
☑ ./test-all-features.sh all pass
```

---

## What Each File Does

| File | Purpose | Read When |
|------|---------|-----------|
| `SETUP_CHECKLIST.md` | Quick checklist | Starting setup |
| `EXTERNAL_SERVICES_SETUP.md` | Detailed instructions | Setting up each service |
| `HOW_TO_VERIFY.md` | Proof system works | After setup, before going live |
| `PROOF_OF_CONCEPT.md` | Complete test guide | Testing everything |
| `CONFIGURATION_TESTING_GUIDE.md` | Config & timezone tests | Testing critical features |
| `VERIFICATION_REPORT.md` | Core functions verified | Validating base system |
| `QUICKSTART.md` | 10-minute start | Quick overview |
| `IMPLEMENTATION_GUIDE.md` | Step-by-step setup (old) | Reference |
| `APPOINTMENT_REMINDERS_README.md` | Architecture & features | Understanding system |

---

## Troubleshooting During Setup

| Problem | Solution |
|---------|----------|
| **SMS not sending** | Check Twilio balance, phone format, credentials |
| **Webhook not receiving** | Verify URL is public, signature validation correct |
| **Reminders not firing** | Check reminder service running, Google Sheets shared |
| **Wrong timezone** | Verify client config, moment().tz() used correctly |
| **Google Sheets connection fails** | Service account email must be shared (Editor role) |
| **Deployment fails** | Check environment variables set in hosting platform |

See: `EXTERNAL_SERVICES_SETUP.md` → Part 7 (Full Troubleshooting)

---

## After Setup: Next Steps

**Week 1:**
- [ ] Create 5 test appointments
- [ ] Verify all SMS receive correctly
- [ ] Monitor logs for errors
- [ ] Check reminders fire on schedule

**Week 2:**
- [ ] Add your real client info to `config/clients.ts`
- [ ] Test with real booking scenario
- [ ] Customize message wording
- [ ] Review data in Google Sheets

**Week 3:**
- [ ] Start selling to first customers
- [ ] Monitor for any issues
- [ ] Collect feedback on messaging
- [ ] Plan next features (email, two-way SMS, etc)

---

## Feature Completeness

**Core System** ✅ Complete
- Webhooks: Appointment creation, no-show, waitlist
- SMS: Confirmation, 24h reminder, 2h reminder, no-show follow-up, waitlist
- Data: Google Sheets storage
- Config: Per-client business name, phone, messages, timezone
- Hosting: Ready for Vercel + Railway

**Extensions** (Not included, but easy to add):
- Email reminders (Sendgrid)
- Two-way SMS (reply STOP, reply YES)
- Dashboard UI (Next.js page)
- Payment integration (Stripe)
- More booking tools (Mindbody, Acuity)
- Multi-location support

---

## Getting Help

**If you get stuck:**

1. **Check the guide first**: `EXTERNAL_SERVICES_SETUP.md` has detailed troubleshooting
2. **Verify prerequisites**: Do you have all 5 accounts created?
3. **Check credentials**: Are they in `.env.local` correctly?
4. **Review environment variables**: Are they set in your hosting platform?
5. **Look at logs**: Check Terminal 1 for error messages

---

## Ready to Start?

**Follow this order:**

1. Read: `SETUP_CHECKLIST.md` (2 min)
2. Execute: `EXTERNAL_SERVICES_SETUP.md` (60 min)
3. Configure: Your `.env.local` (10 min)
4. Verify: `HOW_TO_VERIFY.md` (20 min)
5. Test: `./test-all-features.sh` (5 min)
6. Deploy: Push to Vercel/Railway (5 min)
7. Launch: Update booking tool webhook (2 min)

**Total: ~2 hours**

---

## Success Indicator

**You're done when:**

✅ You receive SMS when creating appointment  
✅ SMS shows correct business name + timezone  
✅ Reminders appear in logs at right times  
✅ No-show follow-up includes rebook link  
✅ Waitlist correctly texts only first person  
✅ All tests pass with `./test-all-features.sh`  
✅ System is live at `https://your-domain.com`  

**Then: Start selling! 💰**

---

## Summary

| Step | Time | Cost |
|------|------|------|
| Create 5 accounts | 60 min | Free (except hosting $27/mo) |
| Configure system | 20 min | Free |
| Test everything | 30 min | Free |
| Go live | 10 min | Free |
| **Total** | **120 min** | **~$27/month** |

**Potential revenue: $99-199/month per client**

---

**You have everything you need. Let's go! 🚀**

Start with: `SETUP_CHECKLIST.md`

