# Missed Call Text-Back Automation - Quick Start

Get your missed call automation up and running in 15 minutes.

## 5-Minute Setup

### Step 1: Create Twilio Account & Get Credentials
1. Sign up at [twilio.com](https://twilio.com)
2. Go to Console Dashboard
3. Copy your **Account SID** and **Auth Token**
4. Buy a phone number (or use trial number)
5. Note the phone number

**Time: 5 min**

### Step 2: Set Environment Variables
Create `.env.local` in the project root:

```bash
# Twilio (required)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=your_token_here
TWILIO_PHONE_NUMBER=+1234567890

# Business (required)
BUSINESS_NAME="Your Business Name"
BUSINESS_OWNER_PHONE=+1234567890
BUSINESS_OWNER_EMAIL=you@yourbusiness.com

# Email (required for owner alerts)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=app_password_from_google

# Database (already configured)
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Airtable (optional - for analytics dashboard)
AIRTABLE_API_KEY=key...
AIRTABLE_BASE_ID=app...
AIRTABLE_MISSED_CALLS_TABLE_ID=tbl...
AIRTABLE_LEADS_TABLE_ID=tbl...
```

**Time: 3 min**

### Step 3: Deploy to Vercel
```bash
npm install
npm run db:migrate
vercel deploy
```

Copy your deployment URL (e.g., `https://my-app.vercel.app`)

**Time: 5 min**

### Step 4: Configure Twilio Webhooks
1. Go to Twilio Console → Phone Numbers
2. Select your number
3. Under "Voice & Fax" section:
   - **A Call Comes In**: Set to `https://your-app.vercel.app/api/webhooks/twilio/incoming-call`
   - **Call Status Changes**: Set to `https://your-app.vercel.app/api/webhooks/twilio/call-status`
4. Save

**Time: 2 min**

---

## Test It Works

### Test 1: Health Check
```bash
curl https://your-app.vercel.app/api/health
```
Should return: `{"status":"ok"...}`

### Test 2: Missed Call (via API)
```bash
curl -X POST https://your-app.vercel.app/api/webhooks/twilio/call-status \
  -d "CallStatus=no-answer&From=%2B15551234567&CallSid=CA123&CallDuration=5"
```
You should receive an SMS at your Twilio number.

### Test 3: Lead Submission
```bash
curl -X POST https://your-app.vercel.app/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","phone":"+15551234567","serviceRequested":"AC Repair"}'
```
Lead should get SMS, you should get email.

---

## How It Works

### When Someone Calls
1. Caller dials your Twilio number
2. Phone rings for up to 20 seconds
3. If not answered → voicemail plays
4. Caller automatically receives SMS: *"Sorry we missed your call! [Business Name] will call you back shortly."*
5. You receive email alert

### When You Get a Lead
1. External form/system POSTs lead data to your webhook
2. Lead immediately receives SMS: *"Hi [Name]! Thanks for reaching out to [Business Name]. We got your message and will reply shortly."*
3. You receive email with lead details
4. Everything logged to your database + Airtable (optional)

---

## Cost Breakdown

| Service | Cost | Notes |
|---------|------|-------|
| Twilio | $1-3/month | + SMS costs (~$0.01/SMS) |
| Vercel | Free | Up to 3 GB bandwidth/month |
| Airtable | Free | Up to 1,200 records |
| Gmail | Free | Use App Passwords |
| **Total** | **~$20/month** | 1,000 calls + 500 leads |

---

## What Gets Logged

**Database (automatically):**
- Timestamp
- Caller/Lead phone number
- Business name
- Status (SMS sent/failed)
- SMS response text

**Airtable (if configured):**
- All database fields above
- Easy dashboard for analytics
- Integrates with other tools

---

## Reselling to Customers

### Multi-Business Setup
```bash
# Add customer via database
npm run db:studio  # Open Prisma Studio
# Create new BusinessConfig record with their info
```

OR via API:
```bash
POST /api/webhooks/lead-submission
{
  "name": "Jane Smith",
  "phone": "+1555987654",
  "serviceRequested": "Plumbing",
  "businessId": 2  // Different business ID
}
```

### Each Business Gets
- ✅ Their own Twilio number (or share one)
- ✅ Custom message templates
- ✅ Their email for alerts
- ✅ Separate Airtable base (optional)
- ✅ Separate database records

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| SMS not sending | Check Twilio balance & number format (+1...) |
| Email not arriving | Enable Gmail App Passwords or verify SMTP |
| Webhook not firing | Verify Twilio webhook URL is correct & public |
| No database records | Run `npm run db:migrate` first |
| Airtable not logging | Check API key & table ID are correct |

---

## Next Steps

1. **Customize Message Templates**
   - Edit `MISSED_CALL_MESSAGE` and `LEAD_SUBMISSION_MESSAGE` in `.env.local`
   - Use `{BUSINESS_NAME}` and `{NAME}` as placeholders

2. **Integrate with CRM**
   - Set up Airtable → Zapier → Your CRM
   - Automatically create leads in Salesforce, HubSpot, etc.

3. **Add Lead Qualification**
   - Request source or priority field in form
   - Route to different team members

4. **Track ROI**
   - Monitor Airtable dashboard
   - Track response rates & conversion

---

## Support

- **API Docs**: See `MISSED_CALL_README.md`
- **Testing Guide**: See `TESTING.md`
- **Deployment Help**: Check Vercel documentation
- **Twilio Issues**: Review Twilio logs in console

---

## One-Command Deploy

```bash
npm install && npm run db:migrate && vercel deploy
```

Then update Twilio webhooks with your new URL.

**You're live! 🚀**
