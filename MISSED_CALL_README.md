# Missed Call Text-Back Automation

A production-ready SaaS automation system for local service businesses (plumbers, HVAC, contractors, etc.) that automatically texts customers who miss calls and logs all interactions.

## Features

- **Automatic Missed Call Texts**: When a customer's call isn't answered within 20 seconds, an automatic text is sent with a callback message
- **Lead Submission Automation**: Accept lead form submissions via webhook, send instant SMS confirmation and alert business owner
- **Multi-Tenant Support**: One deployment can serve multiple businesses with separate configurations
- **Airtable Logging**: All missed calls and leads are logged to Airtable for CRM integration
- **Email Alerts**: Business owners receive instant email notifications for new leads and missed calls
- **Vercel-Ready**: Optimized for serverless deployment on Vercel

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Twilio (SMS & Calls)                     │
└────────────────┬──────────────────────────┬─────────────────┘
                 │                          │
        Incoming Call               Call Completion
                 │                          │
    ┌────────────▼──────────────────────────▼─┐
    │   Next.js API Routes (Serverless)      │
    │  ┌─────────────────────────────────────┤
    │  ├─ /api/webhooks/twilio/incoming-call │
    │  ├─ /api/webhooks/twilio/call-status   │
    │  ├─ /api/webhooks/lead-submission      │
    │  └─ /api/health                        │
    └────────────┬──────────────────────────┘
                 │
         ┌───────┴────────┬─────────────┐
         │                │             │
    ┌────▼────┐  ┌───────▼────┐  ┌────▼──────┐
    │ Supabase │  │ Airtable   │  │  Nodemailer│
    │(Database)│  │ (Analytics)│  │ (Email)    │
    └──────────┘  └────────────┘  └────────────┘
```

## Setup Guide

### Prerequisites

1. **Twilio Account** - Phone number for incoming calls/SMS
2. **Supabase Account** - Database (already configured in this project)
3. **Airtable Account** - For logging and analytics (optional but recommended)
4. **Email Service** - Gmail App Password or SMTP credentials
5. **Vercel Account** - For deployment (free tier works)

### Step 1: Twilio Setup

1. Go to [Twilio Console](https://console.twilio.com/)
2. Get your **Account SID** and **Auth Token** from the dashboard
3. Buy or configure a Twilio phone number
4. In **Phone Numbers** → **Manage Numbers** → Select your number
5. Under "Voice & Fax Configuration":
   - Set **A Call Comes In** to: `Webhook` → `https://your-app.vercel.app/api/webhooks/twilio/incoming-call`
   - Set **Call Status Changes** to: `Webhook` → `https://your-app.vercel.app/api/webhooks/twilio/call-status`

### Step 2: Airtable Setup (Optional but Recommended)

1. Go to [Airtable](https://airtable.com/)
2. Create a new base or use existing
3. Create two tables:
   - **MissedCalls** - with columns: Timestamp, Phone, Name, Business, Type, Status, MissedAt, Response, ResponseReceivedAt
   - **Leads** - with columns: Timestamp, Phone, Name, Business, Service, Type, Status, Response, ResponseReceivedAt

4. Get your:
   - **API Key**: [Account settings](https://airtable.com/account/tokens) → Create Token → Copy API key
   - **Base ID**: From Airtable URL (https://airtable.com/app**XXXXXXXXXXXX**) or via API
   - **Table IDs**: From Airtable URL after selecting a table

### Step 3: Email Configuration

For Gmail (recommended):
1. Go to [Google Account](https://myaccount.google.com)
2. Enable 2-Factor Authentication
3. Create an [App Password](https://myaccount.google.com/apppasswords)
4. Use the generated password in `EMAIL_PASSWORD`

For other providers (Outlook, SendGrid, etc.), configure the appropriate SMTP details.

### Step 4: Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
# ── Database (already configured) ──────────────────────────
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# ── Twilio ─────────────────────────────────────────────────
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="auth_token_here"
TWILIO_PHONE_NUMBER="+1234567890"

# ── Business Configuration ─────────────────────────────────
BUSINESS_NAME="Your Service Business"
BUSINESS_OWNER_PHONE="+1234567890"
BUSINESS_OWNER_EMAIL="owner@yourbusiness.com"

# Message templates (supports {BUSINESS_NAME} and {NAME} placeholders)
MISSED_CALL_MESSAGE="Sorry we missed your call! {BUSINESS_NAME} will call you back shortly."
LEAD_SUBMISSION_MESSAGE="Hi {NAME}! Thanks for reaching out to {BUSINESS_NAME}."

# ── Airtable (optional) ────────────────────────────────────
AIRTABLE_API_KEY="key..."
AIRTABLE_BASE_ID="app..."
AIRTABLE_MISSED_CALLS_TABLE_ID="tbl..."
AIRTABLE_LEADS_TABLE_ID="tbl..."

# ── Email (for owner notifications) ────────────────────────
EMAIL_SERVICE="gmail"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASSWORD="app_password_here"
```

### Step 5: Database Migration

Run the Prisma migration to create the new tables:

```bash
npm run db:migrate
```

### Step 6: Deploy to Vercel

1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Add missed call text-back automation"
   git push origin claude/missed-call-textback-6a4nxe
   ```

2. Deploy with Vercel:
   ```bash
   vercel deploy
   ```

3. Add environment variables in Vercel dashboard:
   - Go to Settings → Environment Variables
   - Add all variables from `.env.local`

4. Update Twilio webhook URLs with your Vercel deployment URL

## API Reference

### Incoming Call Webhook
**POST** `/api/webhooks/twilio/incoming-call`

Automatically called by Twilio when someone dials your business number.

### Call Status Webhook
**POST** `/api/webhooks/twilio/call-status`

Automatically called by Twilio when a call completes. If the call was missed (not answered within 20 seconds), an automatic SMS is sent and logged.

**Response:**
```json
{
  "success": true,
  "recordId": 42
}
```

### Lead Submission Webhook
**POST** `/api/webhooks/lead-submission`

Accept new lead form submissions. Sends SMS to lead and email alert to business owner.

**Request Body:**
```json
{
  "name": "John Doe",
  "phone": "+1234567890",
  "serviceRequested": "Emergency AC Repair",
  "businessId": 1  // Optional, defaults to first business
}
```

**Response:**
```json
{
  "success": true,
  "recordId": 123,
  "textSent": true
}
```

### Health Check
**GET** `/api/health`

Simple health check for monitoring.

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0"
}
```

## Multi-Tenant Setup (For Resale)

To support multiple businesses from one deployment:

1. **Add business via API** or database:
   ```typescript
   const business = await prisma.businessConfig.create({
     data: {
       businessName: "ABC Plumbing",
       businessPhone: "+1234567890",
       ownerPhone: "+1987654321",
       ownerEmail: "owner@abcplumbing.com",
       missedCallMessage: "...",
       airtableApiKey: "...",
       airtableBaseId: "...",
       // etc.
     },
   });
   ```

2. **Pass businessId in webhook calls:**
   ```bash
   curl -X POST https://your-app.vercel.app/api/webhooks/lead-submission \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Jane Smith",
       "phone": "+1234567890",
       "serviceRequested": "HVAC Install",
       "businessId": 1
     }'
   ```

3. **Each business gets separate logs** in Airtable and database

## Testing

### Test Health Endpoint
```bash
curl https://your-app.vercel.app/api/health
```

### Test Lead Submission
```bash
curl -X POST https://your-app.vercel.app/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Customer",
    "phone": "+1234567890",
    "serviceRequested": "Test Service"
  }'
```

### Test with Twilio CLI
```bash
# Simulate incoming call
twilio api:calls:create --from=+15551234567 --to=+1234567890 \
  --url=https://your-app.vercel.app/api/webhooks/twilio/incoming-call

# Simulate call status
curl -X POST https://your-app.vercel.app/api/webhooks/twilio/call-status \
  -d "CallStatus=no-answer&From=%2B15551234567&CallSid=CA123&CallDuration=5"
```

## Data Flow

### Missed Call Flow
1. Caller dials business Twilio number
2. Twilio calls `/api/webhooks/twilio/incoming-call` → returns voicemail TwiML
3. Call completes (no answer or voicemail)
4. Twilio calls `/api/webhooks/twilio/call-status` with call duration
5. System detects missed call (duration < 20s):
   - Sends SMS to caller
   - Logs to database & Airtable
   - Sends email alert to owner
6. If customer replies, SMS is tracked in database

### Lead Submission Flow
1. External form sends POST to `/api/webhooks/lead-submission`
2. System:
   - Sends SMS confirmation to lead
   - Logs to database & Airtable (within 60s)
   - Sends email alert to owner
3. SMS response tracking automatic via Twilio webhooks

## Message Templates

Templates support these variables:
- `{BUSINESS_NAME}` - Auto-replaced with business name
- `{NAME}` - Auto-replaced with customer/lead name

Example:
```
"Sorry we missed your call! {BUSINESS_NAME} will call you back shortly."
→ "Sorry we missed your call! ABC Plumbing will call you back shortly."
```

## Logging & Analytics

### Database Tables
- **MissedCall** - All missed call records with status (sent/failed/responded)
- **LeadSubmission** - All lead submissions with status
- **BusinessConfig** - Business configurations for multi-tenant support

### Airtable Integration
- Automatic sync of all activity to Airtable
- Viewable in Airtable dashboard for CRM integration
- Optional fields: customer name, response text, timestamps

## Troubleshooting

### SMS Not Sending
- Verify Twilio credentials are correct
- Check that phone numbers are in E.164 format (+1234567890)
- Review Twilio logs in console

### Emails Not Arriving
- Enable "Less secure app access" for Gmail (if not using App Password)
- Check EMAIL_USER and EMAIL_PASSWORD are correct
- Review email logs in Next.js console

### Webhooks Not Firing
- Verify Twilio webhook URLs are correct and accessible
- Check that URL is publicly accessible (not localhost)
- Verify Twilio signature verification in production

### Airtable Not Logging
- Verify API key is valid and active
- Check Base ID and Table ID are correct
- Ensure Airtable table has required columns

## Cost Estimation

**Monthly costs for 1,000 missed calls + 500 leads:**
- Twilio: ~$15-25 (SMS + incoming numbers)
- Airtable: Free tier (up to 1,200 records/month)
- Vercel: Free tier (unless exceeds limits)
- Email: Free (Gmail) or low-cost SMTP

**Total: $15-25/month** for a small business

## Production Checklist

- [ ] All environment variables configured
- [ ] Twilio webhooks configured and tested
- [ ] Airtable base created with required tables
- [ ] Email service tested
- [ ] Database migration run
- [ ] Test lead submission works
- [ ] Test missed call flow with Twilio
- [ ] Monitor logs for errors
- [ ] Set up Vercel alerts/monitoring
- [ ] Document business-specific templates

## Support & Extension

### SMS Response Tracking
Responses are automatically tracked when customers reply to texts. View in database or Airtable.

### Webhook Security
In production, Twilio signatures are verified. For development, set `NODE_ENV=development`.

### Custom Logic
Extend the API endpoints to:
- Add CRM integration (Salesforce, HubSpot)
- Route to different teams based on service type
- Add scheduling/callback queue system
- Implement lead scoring

## License

Proprietary - Built for resale to local service businesses
