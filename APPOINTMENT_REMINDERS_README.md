# Appointment Reminder & No-Show Follow-up Automation

A scalable SaaS automation system for service businesses (dental offices, salons, med spas) that sends SMS confirmations, automatic reminders, no-show follow-ups, and manages waitlists.

## Features

- ✅ **Webhook-based appointment ingestion** from Calendly, Cal.com, or custom forms
- ✅ **Instant confirmation texts** upon booking
- ✅ **Automatic reminders** at 24 hours and 2 hours before appointments
- ✅ **No-show follow-ups** with rebook links
- ✅ **Waitlist management** with auto-notification when slots open
- ✅ **Per-client configuration** for business name, messaging, and reminder timing
- ✅ **Google Sheets storage** for data (no database setup needed)
- ✅ **Twilio SMS integration** (cheap, reliable SMS delivery)
- ✅ **Timezone-aware reminders** for distributed teams/locations

## Architecture

```
┌─────────────────────────────────────────┐
│  Booking Tool (Calendly, Cal.com, etc) │
└────────────┬────────────────────────────┘
             │
             │ Webhook POST
             ▼
┌─────────────────────────────────────────┐
│   Next.js API Routes                    │
│  /api/webhooks/appointments             │
│  /api/webhooks/no-show                  │
│  /api/webhooks/waitlist                 │
└────────────┬────────────────────────────┘
             │
             ├──────────────────────────────┐
             │                              │
             ▼                              ▼
      ┌──────────────┐          ┌──────────────────┐
      │ Twilio SMS   │          │ Google Sheets    │
      │ (Send SMS)   │          │ (Data Storage)   │
      └──────────────┘          └──────────────────┘
             ▲
             │
┌────────────┴────────────────────────────┐
│  Node-cron Reminder Service            │
│  (Runs 24/7, checks every 30 min)      │
└─────────────────────────────────────────┘
```

## Setup Guide

### 1. Create a Twilio Account

1. Go to https://www.twilio.com/console
2. Sign up for a free account (includes $15 credit)
3. Navigate to **Phone Numbers** → **Get a Number**
4. Choose a number (domestic or international)
5. Copy your **Account SID** and **Auth Token** from the dashboard

**Cost**: $1/month per phone number + ~$0.0075 per SMS sent

### 2. Set up Google Sheets Integration

1. Go to https://console.cloud.google.com
2. Create a new project
3. Enable the **Google Sheets API**
4. Create a **Service Account**:
   - Click **Create Credentials** → **Service Account**
   - Download the JSON key file
   - Extract: `private_key`, `client_email`, `project_id`

5. Create a new Google Sheet for appointment data
6. Share it with your service account email (from the JSON)

**Cost**: Free (up to Sheets API limits)

### 3. Environment Variables

Create a `.env.local` file in the project root:

```bash
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Google Sheets
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_from_url
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com

# Security
APPOINTMENT_WEBHOOK_SECRET=your_secure_random_key
```

### 4. Start the Reminder Service

The reminder service must run continuously to send scheduled reminders.

**Option A: Local Development**
```bash
npm run reminders:dev
```

**Option B: Production Deployment**
```bash
npm run reminders:start
```

### 5. Configure Your Client

Edit `lib/client-config.ts` to customize messaging per client:

```typescript
registerClientConfig({
  clientId: 'dental-office-1',
  businessName: 'Bright Smile Dental',
  businessPhone: '+1555123456',
  timezone: 'America/New_York',
  reminders: {
    confirmationMessage: 'Hi {{customerName}}, your appointment is confirmed for {{appointmentTime}}. See you soon!',
    reminderMessage24h: 'Hi {{customerName}}, reminder: you have an appointment tomorrow at {{appointmentTime}}!',
    reminderMessage2h: 'Hi {{customerName}}, see you in 2 hours at {{appointmentTime}}!',
    noshowMessage: 'We missed you! Ready to reschedule? Call {{businessPhone}} or book here: {{rebookLink}}',
    rebookLink: 'https://calendly.com/bright-smile',
  },
  schedules: {
    reminder24h: true,
    reminder2h: true,
  },
});
```

## API Endpoints

### POST /api/webhooks/appointments

Create an appointment and send confirmation text.

**Request:**
```bash
curl -X POST http://localhost:3000/api/webhooks/appointments \
  -H "Content-Type: application/json" \
  -H "x-appointment-signature: $(echo -n '{payload}' | openssl dgst -sha256 -hmac 'your_secret' | cut -d' ' -f2)" \
  -d '{
    "clientId": "dental-office-1",
    "customerName": "John Doe",
    "customerPhone": "+1555987654",
    "appointmentDateTime": "2026-07-10T14:30:00Z",
    "serviceType": "Cleaning"
  }'
```

**Response:**
```json
{
  "success": true,
  "appointmentId": "apt_1234567_abc123",
  "message": "Appointment created and confirmation text sent"
}
```

### POST /api/webhooks/no-show

Mark an appointment as no-show and send follow-up text.

**Request:**
```bash
curl -X POST http://localhost:3000/api/webhooks/no-show \
  -H "Content-Type: application/json" \
  -H "x-appointment-signature: $(echo -n '{payload}' | openssl dgst -sha256 -hmac 'your_secret' | cut -d' ' -f2)" \
  -d '{
    "clientId": "dental-office-1",
    "appointmentId": "apt_1234567_abc123"
  }'
```

### POST /api/webhooks/waitlist

Manage waitlist entries and notify when slots open.

**Add to Waitlist:**
```bash
curl -X POST http://localhost:3000/api/webhooks/waitlist \
  -H "Content-Type: application/json" \
  -H "x-appointment-signature: ..." \
  -d '{
    "action": "add",
    "clientId": "dental-office-1",
    "customerName": "Jane Smith",
    "customerPhone": "+1555888888",
    "serviceType": "Cleaning"
  }'
```

**Notify Next on Waitlist:**
```bash
curl -X POST http://localhost:3000/api/webhooks/waitlist \
  -H "x-appointment-signature: ..." \
  -d '{
    "action": "notify",
    "clientId": "dental-office-1",
    "serviceType": "Cleaning",
    "slotDateTime": "2026-07-15T10:00:00Z"
  }'
```

**Confirm Waitlist Customer:**
```bash
curl -X POST http://localhost:3000/api/webhooks/waitlist \
  -H "x-appointment-signature: ..." \
  -d '{
    "action": "confirm",
    "clientId": "dental-office-1",
    "waitlistId": "wl_1234567_abc123"
  }'
```

### Security: Webhook Signatures

All webhooks use HMAC-SHA256 signing for security. To generate a valid signature:

```bash
# Generate signature for your payload
echo -n '{"clientId":"...","customerName":"..."}' | \
  openssl dgst -sha256 -hmac "your_webhook_secret" | \
  cut -d' ' -f2
```

Include in the `x-appointment-signature` header.

## Integration Examples

### Calendly → Appointment Reminder

1. In Calendly, go to **Integrations** → **Webhooks**
2. Add webhook: `https://your-domain.com/api/webhooks/appointments`
3. Select **Invitee scheduled** event
4. In the webhook payload mapping, send:
   ```json
   {
     "clientId": "your-business-id",
     "customerName": "{{invitee.name}}",
     "customerPhone": "{{invitee.phone}}",
     "appointmentDateTime": "{{event.start_time}}",
     "serviceType": "{{event.title}}"
   }
   ```

### Google Forms → Appointment Reminder

Use a service like Zapier or Make.com to route form submissions to the webhook:

1. **Google Form** → **Zapier/Make.com** → **Appointment Reminder Webhook**

## Deployment

### Vercel (Recommended for Next.js + Reminders)

1. Push to GitHub
2. Connect repo to Vercel
3. Add environment variables in **Settings** → **Environment Variables**
4. Deploy: `vercel deploy`

**Challenge**: The reminder service needs to run continuously. Vercel Cron Functions (for Hobby plan+) are limited.

**Solution**: Deploy reminders to a separate service:

**Option A: Railway.app (Cheap, $5/month)**
```bash
# Create a simple reminder-only service
# Deploy lib/reminder-service.ts separately
```

**Option B: Heroku (Free tier exhausted, ~$7/month)**
```bash
heroku create your-app-reminders
git push heroku main
heroku config:set TWILIO_ACCOUNT_SID=...
```

**Option C: Docker on Render.com (~$7/month)**
Create `Dockerfile`:
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "reminders:start"]
```

### Docker Setup

```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
# In a separate container/process:
# CMD ["npm", "run", "reminders:start"]
```

## Cost Breakdown (Monthly)

| Service | Cost | Notes |
|---------|------|-------|
| Twilio Phone | $1.00 | Per phone number |
| Twilio SMS | ~$0.01–0.05 per SMS | ~100 appointments/month = ~$5–25 |
| Google Sheets | Free | Unlimited storage, APIs |
| Vercel | $20 | Next.js hosting (Pro plan for Cron) |
| Reminder Service | $7–20 | Railway.app, Render, or Heroku |
| **Total** | **~$35–50/month** | Supports 1000s of customers |

For comparison: Calendly Premium ($168/year) + dedicated reminder service (~$200/year) = **~$308/year vs. $420–600/year** here, but with full customization and multi-client support.

## Customization & Extensibility

### Add More Reminders

Edit `lib/reminder-service.ts` to add hourly reminders, weekly emails, etc:

```typescript
// Run 6-hour reminders
cron.schedule('*/30 * * * *', () => {
  sendReminders(6);
});
```

### Store to Database Instead of Sheets

Replace Google Sheets calls in `lib/appointments.ts` with Prisma:

```typescript
// Instead of:
await appendRow(`${data.clientId}_appointments`, {...});

// Use:
await prisma.appointment.create({
  data: {...}
});
```

### Add Email Reminders

Add Sendgrid or Mailgun:

```typescript
import sgMail from '@sendgrid/mail';

await sgMail.send({
  to: appointment.customerEmail,
  from: 'noreply@yourservice.com',
  subject: `Reminder: ${appointment.appointmentDateTime}`,
  text: message,
});
```

### White-label for Resale

1. Use `clientId` to isolate data per business
2. Create a dashboard UI in `app/dashboard/[clientId]/`
3. Each client logs in, configures their messaging, views history
4. Charge per SMS or monthly subscription

## Troubleshooting

### SMS Not Sending

- Check Twilio balance (https://console.twilio.com)
- Verify phone numbers include country code: `+1234567890`
- Check logs: `npm run dev` and look for Twilio errors

### Reminders Not Firing

- Ensure reminder service is running: `npm run reminders:dev`
- Check timezone settings match customer timezones
- Verify appointments are in Google Sheets with status `scheduled`

### Google Sheets Connection Failing

- Verify service account email is shared on the spreadsheet
- Check `GOOGLE_SHEETS_PRIVATE_KEY` has literal `\n` (not actual newlines)
- Verify spreadsheet ID from URL

## Support & Next Steps

- Extend to email reminders (Sendgrid)
- Add two-way SMS (reply STOP to cancel)
- Create client dashboard UI
- Integrate with Stripe for payments
- Add lead scoring/CRM features

---

Built with Next.js, Twilio, Google Sheets, and Node-cron.
