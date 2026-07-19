# Missed Call Text-Back Automation

Automatically text customers when they miss your call. Perfect for plumbers, HVAC contractors, electricians, and other service businesses.

## What It Does

```
Customer calls → You don't answer → Customer gets automatic text → You get alerted
```

Features:
- ✅ **Automatic SMS to Customers** - "We missed your call, we'll call you back"
- ✅ **Email Alerts to You** - New lead comes in → you get notified
- ✅ **Call Logging** - All missed calls tracked in database + Airtable
- ✅ **Lead Tracking** - Lead submissions tracked with SMS delivery status
- ✅ **Voicemail Greeting** - Professional automated greeting for incoming calls
- ✅ **Multi-Tenant Ready** - Support multiple businesses/locations

## Getting Started

### Quick Start (15 minutes)

1. **Read the setup guide**: See [SETUP.md](./SETUP.md)
2. **Get your Twilio number**: Free trial at [twilio.com](https://twilio.com)
3. **Deploy to Vercel**: Free hosting at [vercel.com](https://vercel.com)
4. **Test**: Make a test call to verify SMS is sent

### For Developers

```bash
# Install dependencies
npm install

# Set up local database
export DATABASE_URL="file:./prisma/dev.db"
npm run db:migrate

# Start dev server
npm run dev

# Test an endpoint
curl http://localhost:3000/api/health
```

## API Endpoints

### Health Check
```bash
GET /api/health
```
Returns system status. Use this to verify deployment is working.

### Incoming Call Handler
```bash
POST /api/webhooks/twilio/incoming-call
```
Triggered when someone calls your Twilio number. Returns voicemail greeting TwiML.

**Twilio Configuration:**
- Phone Numbers → Your Number → Voice → "A Call Comes In"
- Set to: POST webhook to `https://your-domain.com/api/webhooks/twilio/incoming-call`

### Call Status / Missed Call Handler
```bash
POST /api/webhooks/twilio/call-status
```
Triggered when call ends. If call was missed (no-answer or <20 seconds):
1. Sends SMS to caller
2. Logs to database
3. Logs to Airtable

**Twilio Configuration:**
- Phone Numbers → Your Number → Voice → "Call Status Changes"
- Set to: POST webhook to `https://your-domain.com/api/webhooks/twilio/call-status`

**What "missed" means:**
- Call status is "no-answer" (went to voicemail)
- OR call duration < 20 seconds and status is "completed"

### SMS Inbound Handler (Customer Responses)
```bash
POST /api/webhooks/twilio/sms-inbound
```
Triggered when customer replies to your SMS. Currently logs the response.

**Twilio Configuration:**
- Phone Numbers → Your Number → Messaging → "A Message Comes In"
- Set to: POST webhook to `https://your-domain.com/api/webhooks/twilio/sms-inbound`

### Lead Submission Handler
```bash
POST /api/webhooks/lead-submission
```
Triggered when lead fills out a form (you integrate this into your website).

**Example Request:**
```bash
curl -X POST https://your-domain.com/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith",
    "phone": "+1234567890",
    "serviceRequested": "Emergency plumbing",
    "businessId": 1
  }'
```

**Response:**
```json
{
  "success": true,
  "recordId": 1,
  "textSent": true
}
```

**What happens:**
1. Sends SMS confirmation to lead
2. Sends email alert to business owner
3. Logs to database
4. Logs to Airtable

## Architecture

### Tech Stack
- **Framework**: Next.js 14 (React + API routes)
- **Database**: Supabase (PostgreSQL)
- **SMS**: Twilio
- **Email**: Nodemailer (Gmail SMTP)
- **Logging**: Airtable (optional)
- **Hosting**: Vercel (serverless)

### Database Schema

**BusinessConfig**
Stores configuration for one business:
- businessName, businessPhone, ownerEmail, ownerPhone
- Message templates (with {BUSINESS_NAME} and {NAME} placeholders)
- Airtable credentials (optional)

**MissedCall**
Every missed call creates a record:
- callerPhone, callerName (if available)
- missedAt (when the call happened)
- textSentAt, textStatus (delivery status)
- twilio_call_sid (for tracking)
- airtableId (if logged to Airtable)

**LeadSubmission**
Every lead submission creates a record:
- name, phone, serviceRequested
- textSentAt, textStatus (SMS delivery)
- emailSentToOwner (email alert status)
- airtableId (if logged to Airtable)

### Message Templates

Messages support variable substitution:
- `{BUSINESS_NAME}` → replaced with business name
- `{NAME}` → replaced with customer name

**Defaults:**
- **Missed Call**: "Sorry we missed your call! {BUSINESS_NAME} will call you back shortly. Reply here if you'd like to send details now."
- **Lead Confirmation**: "Hi {NAME}! Thanks for reaching out to {BUSINESS_NAME}. We got your message and will reply shortly."

Customize in environment variables or database.

## Configuration

### Environment Variables (see .env.example)

**Required:**
- `DATABASE_URL` - Supabase connection string
- `TWILIO_ACCOUNT_SID` - From Twilio Console
- `TWILIO_AUTH_TOKEN` - From Twilio Console
- `TWILIO_PHONE_NUMBER` - Your Twilio number
- `BUSINESS_NAME` - Your business name
- `BUSINESS_OWNER_EMAIL` - Email for notifications
- `BUSINESS_OWNER_PHONE` - Your phone number

**Optional:**
- `AIRTABLE_API_KEY` - To log to Airtable
- `AIRTABLE_BASE_ID` - Airtable base ID
- `AIRTABLE_MISSED_CALLS_TABLE_ID` - Table for missed calls
- `AIRTABLE_LEADS_TABLE_ID` - Table for leads
- `EMAIL_USER` - Gmail address for sending emails
- `EMAIL_PASSWORD` - Gmail app password

### Multi-Tenant Setup

To support multiple businesses:
1. Create multiple `BusinessConfig` records in database
2. Each has a unique `businessId`
3. Pass `businessId` in webhook requests
4. System loads config for that business

Example:
```json
{
  "name": "John Smith",
  "phone": "+1234567890",
  "serviceRequested": "Repair",
  "businessId": 2  // Load config for business #2
}
```

## Development

### Local Setup

```bash
# Install dependencies
npm install --legacy-peer-deps

# Create database
export DATABASE_URL="file:./prisma/dev.db"
npm run db:migrate

# Seed with test business
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-direct.ts

# Start dev server
npm run dev

# In another terminal, test endpoints
curl http://localhost:3000/api/health
```

### Testing Endpoints Locally

```bash
# Health check
curl http://localhost:3000/api/health

# Test lead submission
curl -X POST http://localhost:3000/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "phone": "+1234567890",
    "serviceRequested": "Test",
    "businessId": 1
  }'

# Test missed call
curl -X POST http://localhost:3000/api/webhooks/twilio/call-status \
  -d "CallStatus=no-answer&From=%2B1234567890&CallSid=CA12345&CallDuration=5" \
  -H "Content-Type: application/x-www-form-urlencoded"

# Test incoming call
curl -X POST http://localhost:3000/api/webhooks/twilio/incoming-call \
  -d "From=%2B1234567890&CallSid=CA12345" \
  -H "Content-Type: application/x-www-form-urlencoded"
```

### Environment Variables for Local Testing

Create `.env.local`:
```bash
DATABASE_URL="file:./prisma/dev.db"
TWILIO_ACCOUNT_SID="AC_PLACEHOLDER"
TWILIO_AUTH_TOKEN="auth_token_placeholder"
TWILIO_PHONE_NUMBER="+15555551234"
BUSINESS_NAME="Your Service Business"
BUSINESS_OWNER_PHONE="+1234567890"
BUSINESS_OWNER_EMAIL="owner@yourbusiness.com"
EMAIL_SERVICE="gmail"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASSWORD="your-app-password"
NEXTAUTH_SECRET="dev-secret-key-for-local-testing-only"
NEXTAUTH_URL="http://localhost:3000"
```

### Development Notes

- SMS is mocked when Twilio credentials are placeholders
- Email is mocked when using placeholder credentials
- Airtable errors don't crash endpoints (logged to console)
- All webhook endpoints skip signature verification in development

## Deployment

### Deploy to Vercel (Recommended)

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import this GitHub repository
4. Add environment variables (see SETUP.md Step 6)
5. Click Deploy
6. Update Twilio webhook URLs with your Vercel domain

### Environment Variables in Production

**Set in Vercel Project Settings → Environment Variables:**
- All variables from `.env.example`
- Use real Twilio, Supabase, and email credentials
- Keep secrets private

## Monitoring & Troubleshooting

### Check Deployment Status
```bash
curl https://your-domain.vercel.app/api/health
```

### View Logs
- **Vercel Logs**: Vercel Dashboard → Deployments → Select deployment → Logs
- **Supabase Logs**: Supabase Dashboard → Project → Logs
- **Twilio Logs**: Twilio Console → Account → Logs

### Common Issues

**SMS not being sent:**
- Verify Twilio credentials in environment variables
- Check Twilio account has credits
- Check phone number is formatted correctly (+1234567890)

**Email not being sent:**
- Verify EMAIL_USER and EMAIL_PASSWORD are correct
- Make sure you're using Gmail app password (not regular password)
- Check EMAIL_USER matches your Gmail address

**Webhook not being called:**
- Verify webhook URLs in Twilio Console are correct
- Make sure HTTPS is used (not HTTP)
- Check Vercel logs for errors
- Verify Twilio Account SID in environment

**Airtable not logging:**
- Verify AIRTABLE_API_KEY is correct
- Check Base ID and Table IDs are correct
- Airtable failures don't break the workflow (errors logged)

## Performance & Limits

### Free Tier Limits
- **Twilio**: 50 SMS/month free trial + $0.0075 per SMS after
- **Supabase**: 1 project, 500MB database, unlimited API calls (free)
- **Vercel**: 100 deployments/month, no build timeout (free)
- **Airtable**: 1000 records/month (free tier sufficient for testing)
- **Gmail**: Unlimited email sends (using app password)

### Typical Costs at Scale
- **100 calls/month**: ~$3-5 SMS costs, free hosting
- **1000 calls/month**: ~$30-50 SMS costs, may need paid plan

## Roadmap

Future enhancements:
- [ ] Dashboard for viewing calls and leads
- [ ] Custom message builder UI
- [ ] Two-way SMS conversations
- [ ] Call recording storage
- [ ] Integration with appointment scheduling
- [ ] SMS opt-out management
- [ ] Analytics dashboard

## Support & Troubleshooting

See [SETUP.md](./SETUP.md) for detailed setup instructions and troubleshooting.

For issues:
1. Check `.env` variables are set correctly
2. Review Vercel and Twilio logs
3. Test endpoints with curl
4. Verify Twilio webhook URLs are correct

## License

MIT - Feel free to use and modify for your business.

---

**Ready to get started?** Follow the [SETUP.md](./SETUP.md) guide to deploy your first instance!
