# Implementation Guide: Appointment Reminder Automation

Complete step-by-step guide to get the appointment reminder system running.

## Part 1: Set up External Services (30 minutes)

### Step 1.1: Create a Twilio Account

1. Visit https://www.twilio.com/console
2. Sign up with your email
3. Verify your phone number
4. You'll receive $15 free credit for testing

**Get Your Credentials:**
1. Go to https://console.twilio.com/
2. In the left sidebar, find your **Account SID** and **Auth Token** — copy these
3. Click **Phone Numbers** (left sidebar)
4. Click **Get a Number** (you'll use this for sending SMS)
5. Choose a local or toll-free number
6. Confirm and note the number (e.g., `+1234567890`)

**Cost**: $1.00/month per phone number, ~$0.0075 per SMS in the US

### Step 1.2: Set up Google Cloud & Service Account

1. Go to https://console.cloud.google.com/

2. **Create a new project:**
   - Click the project selector at the top
   - Click **NEW PROJECT**
   - Name it: "Appointment Reminders"
   - Click **CREATE**

3. **Enable Google Sheets API:**
   - Make sure you're in the new project
   - Search for "Google Sheets API" in the search bar at the top
   - Click **Google Sheets API**
   - Click **ENABLE**

4. **Create a Service Account:**
   - Go to **Credentials** (left sidebar, under "APIs & Services")
   - Click **+ CREATE CREDENTIALS**
   - Select **Service Account**
   - Fill in:
     - Service account name: `appointment-reminders`
     - Click **CREATE AND CONTINUE**
   - Skip optional steps, click **DONE**

5. **Create and Download JSON Key:**
   - In **Service Accounts** list, click the email of the account you just created
   - Go to **KEYS** tab
   - Click **ADD KEY** → **Create new key**
   - Choose **JSON**
   - Click **CREATE** — the file downloads automatically

6. **Open the JSON file and extract:**
   ```json
   {
     "type": "service_account",
     "project_id": "YOUR_PROJECT_ID",
     "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n",
     "client_email": "appointment-reminders@YOUR_PROJECT_ID.iam.gserviceaccount.com",
     ...
   }
   ```
   - Copy `private_key`, `client_email`, and `project_id`

### Step 1.3: Create a Google Sheet

1. Go to https://sheets.google.com
2. Create a new blank spreadsheet
3. Name it: "Appointment Data"
4. In the URL, copy the ID: `docs.google.com/spreadsheets/d/`**`1ABC123...`**`/edit`
5. Share the sheet:
   - Click **Share** (top right)
   - Paste the service account email (from Step 1.2)
   - Give **Editor** access
   - Don't send a notification (it's a bot account)

## Part 2: Local Development Setup (15 minutes)

### Step 2.1: Install Dependencies

```bash
cd /path/to/project
npm install
```

This installs:
- `twilio` — SMS sending
- `google-spreadsheet` — Google Sheets API
- `node-cron` — Scheduled reminders
- `moment-timezone` — Timezone handling

### Step 2.2: Create Environment File

1. Copy the example:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and fill in your credentials:
   ```bash
   # Twilio
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_PHONE_NUMBER=+1234567890

   # Google Sheets
   GOOGLE_SHEETS_SPREADSHEET_ID=1ABC123...
   GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n"
   GOOGLE_SHEETS_CLIENT_EMAIL=appointment-reminders@project.iam.gserviceaccount.com

   # Security (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
   APPOINTMENT_WEBHOOK_SECRET=your_secure_random_key_here
   ```

**⚠️ Important**: The `GOOGLE_SHEETS_PRIVATE_KEY` should include literal `\n` characters, not actual line breaks. If you paste it directly from the JSON, use this to fix it:

```bash
# The key should have \n not actual newlines
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n"
```

### Step 2.3: Configure Your Clients

1. Copy the example config:
   ```bash
   cp config/clients-example.ts config/clients.ts
   ```

2. Edit `config/clients.ts` to customize for your clients:
   ```typescript
   registerClientConfig({
     clientId: 'your-business-id',
     businessName: 'Your Business Name',
     businessPhone: '+1555123456',
     timezone: 'America/New_York',
     reminders: {
       confirmationMessage: 'Hi {{customerName}}, your appointment is confirmed for {{appointmentTime}}!',
       // ... other messages
     },
     schedules: {
       reminder24h: true,
       reminder2h: true,
     },
   });
   ```

3. Load this in your app. Add to `app/layout.tsx` or initialize on server start:
   ```typescript
   import '../config/clients';
   ```

## Part 3: Running Locally (5 minutes)

### Step 3.1: Start the Next.js Development Server

```bash
npm run dev
```

This starts your API on `http://localhost:3000`

### Step 3.2: Start the Reminder Service (in another terminal)

```bash
npm run reminders:dev
```

You should see:
```
Appointment reminder service started
24-hour reminders: Every hour at :00
2-hour reminders: Every 30 minutes
```

### Step 3.3: Test the Webhooks

In a third terminal:

```bash
ts-node scripts/test-webhooks.ts
```

This will:
1. Create a test appointment
2. Check Twilio logs for SMS
3. Create a waitlist entry
4. Notify the waitlist

**Expected output:**
```
✓ Status: 201
✓ Response: {
  "success": true,
  "appointmentId": "apt_...",
  "message": "Appointment created and confirmation text sent"
}
```

If Twilio is not configured, SMS will be mocked to console:
```
[SMS MOCK] To: +15551234567, Message: Hi John Doe, your appointment is confirmed...
```

## Part 4: Integration with Booking Platforms (varies)

### Option A: Calendly Integration

1. In Calendly, go to **Integrations**
2. Search for **Zapier** or **Webhooks**
3. For webhooks, you'll use a third-party service to transform the payload

**Using Zapier** (easier):
1. Sign up at https://zapier.com
2. Create a Zap: **Calendly** → **Webhooks** → **Your Reminder API**
3. In Calendly integration, configure which events trigger (e.g., "Invitee Scheduled")
4. In Zapier, map fields:
   - `customerName` → Invitee Name
   - `customerPhone` → Invitee Phone
   - `appointmentDateTime` → Event Start Time
   - `serviceType` → Event Title
   - `clientId` → "your-business-id"

5. Send to: `https://your-domain.com/api/webhooks/appointments`
6. Generate signature in Zapier using HMAC-SHA256

### Option B: Generic Form or Cal.com

Any booking tool can send webhooks. The JSON should include:
```json
{
  "clientId": "business-id",
  "customerName": "John Doe",
  "customerPhone": "+1234567890",
  "appointmentDateTime": "2026-07-10T14:30:00Z",
  "serviceType": "Service Type"
}
```

Send as POST to `https://your-domain.com/api/webhooks/appointments` with header:
```
x-appointment-signature: <HMAC-SHA256 hash of body>
```

### Option C: Manual Testing (for demos)

Use curl to simulate:
```bash
#!/bin/bash
PAYLOAD='{"clientId":"dental-office-1","customerName":"John Doe","customerPhone":"+15551234567","appointmentDateTime":"2026-07-10T14:30:00Z","serviceType":"Cleaning"}'
SECRET="your_webhook_secret"
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

curl -X POST http://localhost:3000/api/webhooks/appointments \
  -H "Content-Type: application/json" \
  -H "x-appointment-signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

## Part 5: Deployment (30 minutes)

### Option 1: Vercel + Railway (Recommended)

**Deploy Next.js app to Vercel:**
1. Push to GitHub: `git push origin main`
2. Go to https://vercel.com/new
3. Import your GitHub repository
4. Add environment variables from `.env.local`
5. Deploy

**Deploy reminder service to Railway:**
1. Go to https://railway.app
2. Click **New Project** → **GitHub Repo**
3. Connect your repo
4. Set environment variables (same as `.env.local`)
5. Set start command: `npm run reminders:start`
6. Deploy

**Cost**: ~$5–10/month (Railway) + $20/month (Vercel Pro)

### Option 2: Single Docker Container (Heroku, Render, Railway)

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start"]
```

Then in a separate container, run:
```dockerfile
CMD ["npm", "run", "reminders:start"]
```

Or use `docker-compose` to run both:

```yaml
version: '3'
services:
  web:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    command: npm run start

  reminders:
    build: .
    env_file: .env
    command: npm run reminders:start
```

### Option 3: AWS Lambda + EventBridge (Serverless)

For large-scale deployments:
1. Deploy Next.js to AWS Amplify
2. Deploy reminder service as Lambda function
3. Trigger with EventBridge (replaces node-cron)

## Part 6: Verify Everything Works

### Checklist:

- [ ] Twilio account created with phone number and credentials
- [ ] Google Cloud project with Service Account and JSON key
- [ ] Google Sheet created and shared with service account
- [ ] `.env.local` filled with all credentials
- [ ] `config/clients.ts` created with at least one client config
- [ ] `npm run dev` starts without errors
- [ ] `npm run reminders:dev` shows cron jobs scheduled
- [ ] `npm run test-webhooks.ts` creates appointments successfully
- [ ] Check Google Sheets — appointments appear in sheet
- [ ] Check Twilio Console — SMS shows in activity log (or mocked to console)

### Monitor Reminders

While development server is running, you can manually trigger reminders:

```bash
ts-node -e "
import { sendReminders } from './lib/reminder-service';
sendReminders(24);
"
```

## Part 7: Multi-Client Setup

To support multiple service businesses:

1. **Register each client** in `config/clients.ts`
2. **Each client gets a unique `clientId`**
3. **Data isolation** — Google Sheets uses `{clientId}_appointments` sheet
4. **Webhook accepts `clientId`** in request body
5. **Customers get business-specific messages**

Example:
```bash
# Dental office appointment
curl -X POST https://your-domain.com/api/webhooks/appointments \
  -H "x-appointment-signature: ..." \
  -d '{"clientId": "dental-office-1", ...}'

# Salon appointment
curl -X POST https://your-domain.com/api/webhooks/appointments \
  -H "x-appointment-signature: ..." \
  -d '{"clientId": "salon-1", ...}'
```

Each client's data and messaging is completely isolated.

## Troubleshooting

### SMS Not Sending

**Check 1:** Twilio balance
- Go to https://console.twilio.com — see your balance
- Free accounts have a $15 limit

**Check 2:** Phone number format
- Must include country code: `+1234567890` (not just `1234567890`)

**Check 3:** Logs
- Run `npm run dev` and check console for errors
- Look for "Error sending SMS" messages

### Reminders Not Firing

**Check 1:** Reminder service running
- You must run `npm run reminders:dev` in separate terminal
- Should show: "Appointment reminder service started"

**Check 2:** Timezone settings
- Verify timezone in client config matches where appointments happen
- Reminders send when local time reaches the threshold

**Check 3:** Appointment status
- Appointments must be in Google Sheets with status `"scheduled"`
- Completed/no-show/cancelled appointments are skipped

### Google Sheets Connection Failing

**Check 1:** Service account is shared
- Open your Google Sheet
- Click **Share**
- Verify service account email is listed with Editor access

**Check 2:** Private key formatting
- Must have literal `\n` in string: `"-----BEGIN PRIVATE KEY-----\n..."`
- NOT actual line breaks

**Check 3:** Spreadsheet ID
- From URL: `docs.google.com/spreadsheets/d/`**`1ABC123XYZ`**`/edit`
- Copy just the ID part

## Next Steps

1. **Extend messaging** — Add email reminders, two-way SMS
2. **Build a dashboard** — Let customers see/manage appointments
3. **Add integrations** — Connect to more booking tools
4. **White-label** — Resell to multiple businesses as SaaS
5. **Payment** — Integrate Stripe for subscription billing

---

Need help? Check `APPOINTMENT_REMINDERS_README.md` for architecture and cost details.
