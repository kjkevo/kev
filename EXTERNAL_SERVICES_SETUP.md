# External Services Setup Guide

Complete setup for Twilio, booking tools, Google Sheets, and hosting.

---

## Part 1: Twilio Account Setup (15 minutes)

### Step 1.1: Create Twilio Account

1. Go to https://www.twilio.com/console
2. Click **Sign up**
3. Fill in your details:
   - Email
   - Password
   - Phone number (for verification)
4. Verify your phone number (receive SMS code)

### Step 1.2: Get Your Credentials

After signup, you're in the Twilio Console dashboard:

1. **Find Account SID**: 
   - Look at the top of the dashboard
   - Copy the **Account SID** (looks like: `ACxxxxxxxxxxxxxxxxxxxxxxxxxx`)

2. **Find Auth Token**:
   - Still in the top section
   - Click "Show" next to Auth Token
   - Copy it (looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5`)

3. **Store securely** (you'll need these in `.env.local`)

### Step 1.3: Get a Phone Number

1. In the left sidebar, click **Phone Numbers**
2. Click **Get a Number**
3. Choose:
   - Country: United States (or your country)
   - Search capabilities: **SMS** (check this)
   - Area code: Pick your area code or any
4. Click **Buy** ($1.00/month)
5. Copy the phone number (looks like: `+1234567890`)

**Your Twilio credentials are now ready:**
```
TWILIO_ACCOUNT_SID = ACxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN = a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5
TWILIO_PHONE_NUMBER = +1234567890
```

### Step 1.4: Test Twilio (Optional)

In the Twilio Console:

1. Go to **Messaging** → **Try it Out**
2. **From**: Select your phone number
3. **To**: Enter your cell phone number (with country code)
4. **Message**: "Hello from Twilio!"
5. Click **Send**

You should receive a text message!

---

## Part 2: Google Sheets Setup (20 minutes)

Google Sheets is **free** and works great for appointment data. Better than Airtable for this use case (simpler, no cost).

### Step 2.1: Create Google Cloud Project

1. Go to https://console.cloud.google.com/
2. Sign in with your Google account
3. At the top, click **Select a Project** → **NEW PROJECT**
4. Name it: `appointment-reminders`
5. Click **CREATE**
6. Wait for project to be created (1-2 minutes)

### Step 2.2: Enable Google Sheets API

1. In the search bar at the top, search: **Google Sheets API**
2. Click **Google Sheets API**
3. Click **ENABLE**
4. Wait for it to enable

### Step 2.3: Create Service Account

1. Go to **APIs & Services** → **Credentials** (left sidebar)
2. Click **+ CREATE CREDENTIALS**
3. Select **Service Account**
4. Fill in:
   - Service account name: `appointment-reminders`
   - Service account ID: (auto-filled)
5. Click **CREATE AND CONTINUE**
6. **Grant roles** (optional but good for security):
   - Click **+ GRANT ROLE**
   - Search: `Editor`
   - Select **Editor**
   - Click **CONTINUE**
7. Click **DONE**

### Step 2.4: Download Service Account JSON Key

1. Go to **APIs & Services** → **Credentials**
2. Under **Service Accounts**, click the email (appointment-reminders@...)
3. Go to **KEYS** tab
4. Click **ADD KEY** → **Create new key**
5. Select **JSON**
6. Click **CREATE**
7. **JSON file downloads automatically** — save it somewhere safe
8. Open the JSON file and find:
   ```json
   {
     "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEv...",
     "client_email": "appointment-reminders@project-id.iam.gserviceaccount.com",
     "project_id": "appointment-reminders-123456"
   }
   ```

**Copy these three values for `.env.local`:**
- `private_key` (entire key including `\n`)
- `client_email`
- `project_id` (not needed in this system, but save it)

### Step 2.5: Create Google Sheet for Appointments

1. Go to https://sheets.google.com/
2. Click **+ Create** → **Blank spreadsheet**
3. Name it: `Appointment Data`
4. You now have a sheet with ID in the URL: `https://docs.google.com/spreadsheets/d/`**`1ABC123XYZ`**`/edit`

**Save the Spreadsheet ID**: `1ABC123XYZ`

### Step 2.6: Share Sheet with Service Account

This is crucial — the service account needs permission to write to the sheet:

1. In your Google Sheet, click **Share** (top right)
2. Click **Share**
3. Paste the service account email: `appointment-reminders@project-id.iam.gserviceaccount.com`
4. Select **Editor** role
5. **Uncheck** "Notify people" (it's a bot)
6. Click **Share**

**Google Sheets is ready!** The system will create sheets for appointments and waitlists automatically.

**Your Google Sheets credentials:**
```
GOOGLE_SHEETS_SPREADSHEET_ID = 1ABC123XYZ
GOOGLE_SHEETS_PRIVATE_KEY = -----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n
GOOGLE_SHEETS_CLIENT_EMAIL = appointment-reminders@project-id.iam.gserviceaccount.com
```

---

## Part 3: Booking Tool Setup

Choose ONE of these three options:

### Option A: Calendly Webhook (Recommended - Most Popular)

**Calendly** is the most popular scheduling tool. It has direct webhook support.

#### Setup Calendly Webhook

1. **If you don't have Calendly**, sign up: https://calendly.com/
2. Log in to your Calendly account
3. Go to **Settings** (gear icon, top right)
4. Click **Integrations** (left sidebar)
5. Search for **Webhooks** (or scroll down)
6. Click **Webhooks**
7. Click **+ Add Webhook**
8. **Endpoint URL**: `https://your-domain.com/api/webhooks/appointments`
   - Replace `your-domain.com` with your actual domain (see Hosting section below)
9. **Select events**: Check **Invitee scheduled**
10. Click **Create webhook**

#### Map Calendly Fields to Appointment System

The webhook sends data, but you need to format it. Use **Zapier** (easier) or configure the webhook payload mapping.

**Using Zapier** (recommended for less technical setup):

1. Go to https://zapier.com
2. Sign up for free account
3. Create a **Zap**: **Calendly** → **Webhooks**
4. Trigger: **Event type** → Select **Invitee scheduled**
5. Action: **Catch Raw Hook**
6. In the action, map fields:
   ```
   clientId: "your-business-id"  (e.g., "dental-office-1")
   customerName: Invitee Name
   customerPhone: Invitee Phone
   appointmentDateTime: Event Start Time
   serviceType: Event Title
   ```
7. Test the zap
8. Send to: `https://your-domain.com/api/webhooks/appointments`

**Your Calendly is ready!**

---

### Option B: Cal.com Webhook

**Cal.com** is open-source and newer (similar to Calendly).

#### Setup Cal.com Webhook

1. Sign up: https://cal.com
2. Log in
3. Go to **Settings** (gear icon)
4. Click **Integrations**
5. Search **Webhooks** (or **Zapier**)
6. Click **+ Add Webhook**
7. **Payload URL**: `https://your-domain.com/api/webhooks/appointments`
8. **Trigger**: Select **Booking created**
9. Save webhook

Same Zapier mapping as Calendly above.

**Your Cal.com is ready!**

---

### Option C: Generic Form (For Custom Booking System)

If you have your own booking form or use **Typeform**, **Google Forms**, etc., route it to the webhook.

#### Using Zapier with Google Forms

1. Create a Google Form with fields:
   - Customer Name
   - Phone Number
   - Service Type
   - Preferred Date/Time

2. Go to Zapier, create **Zap**: **Google Forms** → **Webhooks**
3. Trigger: **New Response**
4. Action: **Catch Raw Hook**
5. Map Google Form fields to appointment fields:
   ```
   clientId: "your-business-id"
   customerName: Name field
   customerPhone: Phone field
   appointmentDateTime: Date/Time field
   serviceType: Service Type field
   ```
6. Send POST to: `https://your-domain.com/api/webhooks/appointments`

#### Using Make.com (Alternative to Zapier)

1. Go to https://make.com
2. Create **Scenario**: **Google Forms** → **Webhooks**
3. Same field mapping as above
4. Send to: `https://your-domain.com/api/webhooks/appointments`

**Your custom form is ready!**

---

## Part 4: Hosting Setup (Choose One)

You need to host:
1. **Next.js API** (the webhooks) - Can go anywhere
2. **Reminder Service** (runs 24/7) - Needs continuous uptime

### Option A: Vercel + Railway (Recommended, ~$27/month)

**Best for:** Easiest setup, good for starting out

#### Deploy Next.js to Vercel

1. **Prerequisites**: Code on GitHub
2. Go to https://vercel.com
3. Click **Sign up** → **Continue with GitHub**
4. Authorize Vercel
5. Click **Import Project**
6. Find your repo (`kjkevo/kev`) → Click **Import**
7. **Framework**: Automatically detects Next.js
8. **Environment Variables**: Add:
   ```
   TWILIO_ACCOUNT_SID = ACxxxxxxxxxx
   TWILIO_AUTH_TOKEN = xxxxx
   TWILIO_PHONE_NUMBER = +1234567890
   GOOGLE_SHEETS_SPREADSHEET_ID = 1ABC123XYZ
   GOOGLE_SHEETS_PRIVATE_KEY = -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
   GOOGLE_SHEETS_CLIENT_EMAIL = appointment-reminders@...
   APPOINTMENT_WEBHOOK_SECRET = your-secret-key
   ```
9. Click **Deploy**
10. Wait 2-3 minutes
11. Get your URL: `https://your-app.vercel.app`

**Your API is now live!**

#### Deploy Reminder Service to Railway

The reminder service needs to run continuously. Vercel is serverless (no 24/7 processes), so use Railway.

1. Go to https://railway.app
2. Click **Start New Project**
3. Click **Deploy from GitHub repo**
4. Select your repo
5. In the Railway dashboard:
   - Click **Variables**
   - Add same environment variables as Vercel
6. Click **Deploy**
7. Service will start running

**Your reminder service is now running 24/7!**

**Cost**: 
- Vercel Pro: $20/month
- Railway: $7/month
- **Total: ~$27/month**

---

### Option B: Docker on Render.com (~$7/month each)

**Best for:** Lower cost, more control

#### Create Dockerfile

In your project root, create `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "build && npm", "start"]
```

#### Deploy Next.js to Render

1. Go to https://render.com
2. Sign up → Click **New +**
3. Select **Web Service**
4. Connect your GitHub repo
5. **Build command**: `npm install && npm run build`
6. **Start command**: `npm run start`
7. Add environment variables
8. Click **Create Web Service**

#### Deploy Reminder Service to Render (Separate)

1. In Render, click **New +** → **Web Service**
2. Same repo
3. **Build command**: `npm install`
4. **Start command**: `npm run reminders:start`
5. Click **Create Web Service**

**Cost**: ~$7/month each (so ~$14 total)

---

### Option C: Heroku (Legacy, ~$14/month)

Heroku is dying, but still works:

1. https://heroku.com
2. Sign up
3. Create **New App** → Connect GitHub
4. Deploy main branch
5. Add buildpacks: `node`
6. Add environment variables
7. Enable Dyno for 24/7 running ($7/month)
8. Deploy same repo twice (once for API, once for reminders with different start command)

**Cost**: ~$14/month

---

### Option D: AWS (Most Flexible, ~$20-50/month)

For large-scale deployments:

1. **API**: EC2 instance running Next.js (~$10/month)
2. **Reminders**: Same EC2 or Lambda (~$10/month)
3. **Database**: RDS PostgreSQL (~$15/month) - optional

This is more complex but most scalable.

---

## Part 5: Configure Your Environment

### Step 5.1: Update `.env.local`

Create file in project root:

```bash
# .env.local

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5
TWILIO_PHONE_NUMBER=+1234567890

# Google Sheets
GOOGLE_SHEETS_SPREADSHEET_ID=1ABC123XYZ
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_CLIENT_EMAIL=appointment-reminders@project-id.iam.gserviceaccount.com

# Appointment System
APPOINTMENT_WEBHOOK_SECRET=your-super-secret-random-key-here

# For production, also set these
NEXTAUTH_SECRET=another-random-secret-key
NEXTAUTH_URL=https://your-domain.com
```

**Important**: Never commit `.env.local` to GitHub!

### Step 5.2: Verify Locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000/api/webhooks/appointments` — should see endpoint info.

### Step 5.3: Update Booking Tool Webhook URL

Once your hosting is set up, update your booking tool:

**For Calendly/Cal.com/Zapier:**
- Change webhook URL from `localhost` to: `https://your-vercel-app.vercel.app/api/webhooks/appointments`

---

## Part 6: Complete Verification Checklist

```
TWILIO
☑ Account created
☑ Phone number purchased ($1/month)
☑ Account SID copied
☑ Auth Token copied
☑ Test SMS sent successfully

GOOGLE SHEETS
☑ Google Cloud project created
☑ Google Sheets API enabled
☑ Service account created
☑ JSON key downloaded and stored safely
☑ Google Sheet created
☑ Service account email shared (Editor role)
☑ private_key, client_email copied

BOOKING TOOL
☑ Calendly/Cal.com/Form set up
☑ Zapier/Make account created (if needed)
☑ Webhook URL configured
☑ Field mapping done (Name, Phone, DateTime, Service)
☑ Test booking created
☑ SMS received from test booking ✅

HOSTING
☑ Vercel (or alternative) account created
☑ GitHub repo connected
☑ Environment variables added
☑ API deployed and live at https://your-domain.com
☑ Reminder service deployed (on Railway or separate dyno)
☑ API endpoint accessible from booking tool

CONFIGURATION
☑ .env.local updated with all credentials
☑ config/clients.ts has your business(es)
☑ Business names, phones, messages customized
☑ Timezones set correctly
☑ Webhook secret matches in booking tool

VERIFICATION
☑ Create test appointment via booking tool
☑ Receive confirmation SMS
☑ Appointment appears in Google Sheets
☑ Check scheduler in Terminal for reminder timing
```

---

## Part 7: Troubleshooting

### SMS Not Sending

**Check 1**: Twilio balance
- Go to https://console.twilio.com
- Look for balance (starts with $15 free)
- If $0, buy credits

**Check 2**: Phone number format
- Must be: `+1234567890` (+ prefix, full country code)
- Not: `1234567890` or `(123) 456-7890`

**Check 3**: Credentials in `.env.local`
- Verify TWILIO_ACCOUNT_SID is correct
- Verify TWILIO_AUTH_TOKEN is correct (no spaces)
- Restart `npm run dev`

### Webhook Not Receiving Data

**Check 1**: URL is publicly accessible
- Test: `curl https://your-domain.com/api/webhooks/appointments`
- Should return 200 or show endpoint message

**Check 2**: Webhook signature validation
- In Calendly/Zapier, check request headers
- Verify `x-appointment-signature` is being sent
- Verify APPOINTMENT_WEBHOOK_SECRET matches both places

**Check 3**: Booking tool configured correctly
- In Calendly: Go to Settings → Integrations → Webhooks
- Verify URL is your live domain (not localhost)
- Verify event type is "Invitee scheduled"

### Reminders Not Firing

**Check 1**: Reminder service is running
- Make sure `npm run reminders:dev` is running
- Check for "Appointment reminder service started"

**Check 2**: Google Sheets connected
- Verify service account email is shared on sheet
- Check logs for connection errors

**Check 3**: Appointment time is correct
- Appointment must be ~24h or ~2h away
- Timezone must match client config
- Time must be in future (not past)

---

## Part 8: Cost Summary

| Service | Cost | What It Does |
|---------|------|-------------|
| **Twilio** | $1/mo + $0.01/SMS | SMS delivery (~$5-25/mo for 100 appts) |
| **Google Sheets** | Free | Data storage |
| **Vercel** | $20/mo | API hosting |
| **Railway** | $7/mo | Reminder service 24/7 |
| **Domain (optional)** | $0-15/yr | Custom domain name |
| **Total** | **$28-48/mo** | Supports thousands of customers |

---

## Part 9: Going Live Checklist

Before selling to customers:

```
SECURITY
☑ APPOINTMENT_WEBHOOK_SECRET is strong (random)
☑ Environment variables never in code
☑ HTTPS only (all providers use this)
☑ HMAC-SHA256 signature validation on all webhooks

RELIABILITY
☑ Reminder service set to restart on crash (Railway/Render does this)
☑ Error monitoring (optional but recommended: Sentry)
☑ Google Sheets has backup (Google does automatic)
☑ Twilio has failover configured

MONITORING
☑ Log errors somewhere (console for now)
☑ Monitor SMS delivery rates
☑ Track appointment data in Sheets
☑ Set up alerts for failures

DATA PRIVACY
☑ Explain data is stored in Google Sheets
☑ Clear privacy policy
☑ No unnecessary data collection
☑ Delete old data regularly (GDPR)
```

---

## Summary

You now have:

- ✅ **Twilio** — Sending SMS ($1/mo + cost per SMS)
- ✅ **Google Sheets** — Free appointment data storage
- ✅ **Calendly/Cal.com/Zapier** — Booking tool integration
- ✅ **Vercel + Railway** — Production hosting ($27/mo)
- ✅ **All credentials** — In `.env.local`

**Next Step**: Run `npm run dev` locally, test with the verification guide, then deploy!

