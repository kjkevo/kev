# Setup Checklist - Quick Reference

Use this checklist to track your setup progress. Estimated time: **1-2 hours**.

---

## 🟦 Phase 1: Twilio (15 minutes)

- [ ] Go to https://www.twilio.com/console
- [ ] Sign up for account
- [ ] Verify phone number
- [ ] Get **Account SID** — copy to notepad
- [ ] Get **Auth Token** — copy to notepad
- [ ] Buy a phone number under **Phone Numbers**
- [ ] Get **Phone Number** — copy to notepad
- [ ] *(Optional)* Test by sending yourself a text message

**Result**: 
```
TWILIO_ACCOUNT_SID = AC...
TWILIO_AUTH_TOKEN = ...
TWILIO_PHONE_NUMBER = +1...
```

---

## 🟦 Phase 2: Google Sheets (20 minutes)

- [ ] Go to https://console.cloud.google.com/
- [ ] Create **New Project** named `appointment-reminders`
- [ ] Enable **Google Sheets API**
- [ ] Create **Service Account** (name: `appointment-reminders`)
- [ ] Create and download **JSON Key**
- [ ] Open JSON file, extract:
  - [ ] `private_key` — copy to notepad
  - [ ] `client_email` — copy to notepad
- [ ] Go to https://sheets.google.com/
- [ ] Create **New Spreadsheet** named `Appointment Data`
- [ ] Get **Spreadsheet ID** from URL — copy to notepad
- [ ] Click **Share**
- [ ] Paste service account email
- [ ] Give **Editor** permission
- [ ] Don't notify the bot

**Result**:
```
GOOGLE_SHEETS_SPREADSHEET_ID = 1ABC...
GOOGLE_SHEETS_PRIVATE_KEY = -----BEGIN...
GOOGLE_SHEETS_CLIENT_EMAIL = appointment-reminders@...
```

---

## 🟦 Phase 3: Booking Tool (15 minutes)

### Option A: Calendly
- [ ] Go to https://calendly.com (sign up if needed)
- [ ] Settings → Integrations → Webhooks
- [ ] Add Webhook
- [ ] Set endpoint (leave blank for now, update later)
- [ ] Select "Invitee scheduled"
- [ ] Save webhook

### Option B: Cal.com
- [ ] Go to https://cal.com (sign up if needed)
- [ ] Settings → Integrations → Webhooks
- [ ] Add Webhook
- [ ] Set endpoint (leave blank for now, update later)
- [ ] Select "Booking created"
- [ ] Save webhook

### Option C: Zapier + Your Form
- [ ] Create form (Google Forms, Typeform, etc)
- [ ] Go to https://zapier.com
- [ ] Create Zap: **[Your Form] → Webhooks**
- [ ] Map fields (Name, Phone, DateTime, Service)
- [ ] Set endpoint (leave blank for now, update later)

**Result**: Booking tool configured, webhook URL pending

---

## 🟦 Phase 4: Hosting (30 minutes)

### Option A: Vercel + Railway (Recommended)

#### 4a.1: Vercel (API)
- [ ] Push code to GitHub (if not already done)
- [ ] Go to https://vercel.com
- [ ] Sign up with GitHub
- [ ] Import your repo
- [ ] Add **Environment Variables**:
  - [ ] TWILIO_ACCOUNT_SID
  - [ ] TWILIO_AUTH_TOKEN
  - [ ] TWILIO_PHONE_NUMBER
  - [ ] GOOGLE_SHEETS_SPREADSHEET_ID
  - [ ] GOOGLE_SHEETS_PRIVATE_KEY
  - [ ] GOOGLE_SHEETS_CLIENT_EMAIL
  - [ ] APPOINTMENT_WEBHOOK_SECRET (generate random string)
- [ ] Click **Deploy**
- [ ] Wait 2-3 minutes
- [ ] Copy your URL: `https://your-app.vercel.app`
- [ ] Update booking tool webhook URL to: `https://your-app.vercel.app/api/webhooks/appointments`

#### 4a.2: Railway (Reminder Service)
- [ ] Go to https://railway.app
- [ ] Sign up
- [ ] **New Project** → **Deploy from GitHub repo**
- [ ] Select your repo
- [ ] Click **Variables** tab
- [ ] Add same environment variables as Vercel
- [ ] Deployment starts automatically

### Option B: Docker + Render (Lower Cost)
- [ ] Create `Dockerfile` in project root (see guide)
- [ ] Go to https://render.com
- [ ] Sign up
- [ ] **New Web Service** → GitHub repo
- [ ] Build: `npm install && npm run build`
- [ ] Start: `npm run start`
- [ ] Add environment variables
- [ ] Deploy (2x for API and reminders with different start commands)

**Result**: 
```
API URL: https://your-domain.com/api/webhooks/appointments
Reminder service: Running 24/7
```

---

## 🟦 Phase 5: Local Configuration (10 minutes)

- [ ] Create `.env.local` in project root
- [ ] Add all credentials:
  ```
  TWILIO_ACCOUNT_SID=...
  TWILIO_AUTH_TOKEN=...
  TWILIO_PHONE_NUMBER=...
  GOOGLE_SHEETS_SPREADSHEET_ID=...
  GOOGLE_SHEETS_PRIVATE_KEY=...
  GOOGLE_SHEETS_CLIENT_EMAIL=...
  APPOINTMENT_WEBHOOK_SECRET=...
  ```
- [ ] Edit `config/clients.ts`
  - [ ] Set your business ID (e.g., `dental-office-1`)
  - [ ] Set business name (e.g., `Bright Smile Dental`)
  - [ ] Set business phone
  - [ ] Set timezone
  - [ ] Customize messages
- [ ] Run `npm install`
- [ ] Run `npm run dev` — verify no errors
- [ ] Run `npm run reminders:dev` — verify it starts

---

## 🟦 Phase 6: Testing (20 minutes)

### Local Testing
- [ ] Create appointment via your booking tool
- [ ] Check Terminal 1 for `[SMS MOCK]` message
- [ ] Verify SMS has correct business name
- [ ] Verify SMS shows correct timezone
- [ ] Run `./test-all-features.sh`
- [ ] Verify all tests pass

### End-to-End Testing (After Deployment)
- [ ] Create test appointment via live booking tool
- [ ] Check logs for SMS delivery
- [ ] Verify SMS shows correct business name
- [ ] Create 2 waitlist entries
- [ ] Trigger slot opening
- [ ] Verify only first person texted
- [ ] Mark as confirmed
- [ ] Verify others not contacted

---

## 🟦 Phase 7: Final Verification

- [ ] API responds at your live URL
- [ ] Webhooks from booking tool reach API (check logs)
- [ ] SMS sends immediately after booking
- [ ] Reminders fire at correct times (check logs)
- [ ] No-show follow-up works
- [ ] Waitlist logic correct
- [ ] Timezone displays correct
- [ ] All client configs working
- [ ] Google Sheets has appointment data

---

## Credentials Needed (Gather These First)

Before you start, have these ready:

```
TWILIO:
□ Account SID
□ Auth Token  
□ Phone Number

GOOGLE SHEETS:
□ Spreadsheet ID
□ Private Key
□ Service Account Email

BOOKING TOOL:
□ Account created
□ Credentials ready

WEBHOOK SECRET:
□ Generated random string (e.g., openssl rand -hex 32)
```

---

## Timeline

- **Phase 1 (Twilio)**: 15 min
- **Phase 2 (Google Sheets)**: 20 min
- **Phase 3 (Booking Tool)**: 15 min
- **Phase 4 (Hosting)**: 30 min
- **Phase 5 (Config)**: 10 min
- **Phase 6 (Testing)**: 20 min
- **Phase 7 (Final)**: 10 min

**Total: ~2 hours**

---

## Getting Stuck?

Check these guides:

| Problem | Guide |
|---------|-------|
| How do I know it's working? | `HOW_TO_VERIFY.md` |
| Detailed Twilio/Sheets setup | `EXTERNAL_SERVICES_SETUP.md` |
| Configuration & timezone issues | `CONFIGURATION_TESTING_GUIDE.md` |
| All core functions verified | `VERIFICATION_REPORT.md` |
| Step-by-step with examples | `PROOF_OF_CONCEPT.md` |

---

## Supported Booking Tools

✅ **Fully Supported**:
- Calendly
- Cal.com
- Any tool with Zapier/Make integration

✅ **Can Be Added**:
- Acuity Scheduling
- Mindbody
- Setmore
- Your custom form

---

## Cost Breakdown

| Service | Cost | Required? |
|---------|------|-----------|
| Twilio | $1/mo + SMS | ✅ Yes |
| Google Sheets | Free | ✅ Yes |
| Vercel | $20/mo | ✅ Yes (or alternative) |
| Railway | $7/mo | ✅ Yes (for reminders) |
| Calendly/Cal.com | Free | ✅ Yes (or Zapier) |
| **Total** | **~$28/mo** | |

---

## Success Indicator

✅ **You're Done When:**

1. You receive SMS when you create an appointment
2. SMS shows correct business name and timezone
3. You see reminders in logs at the right times
4. Waitlist correctly texts only first person
5. No-show follow-up includes rebook link
6. All tests in `./test-all-features.sh` pass

**Then you can start selling! 🚀**

---

## Next Steps After Setup

1. **Test with real customers** — Try with a few test bookings
2. **Monitor logs** — Watch for errors in deployment platform
3. **Refine messaging** — Adjust SMS wording based on customer feedback
4. **Add more clients** — Register new business configs in `config/clients.ts`
5. **Scale messaging** — Consider email integration (bonus feature)

---

## Have Questions?

- **Can't get Twilio working?** → `EXTERNAL_SERVICES_SETUP.md` Part 1
- **Google Sheets connection issues?** → `EXTERNAL_SERVICES_SETUP.md` Part 2
- **Webhook not receiving data?** → `EXTERNAL_SERVICES_SETUP.md` Part 7 (Troubleshooting)
- **Not seeing reminders?** → `HOW_TO_VERIFY.md`
- **Timezone wrong?** → `CONFIGURATION_TESTING_GUIDE.md`

