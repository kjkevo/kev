# Testing Guide - Missed Call Text-Back Automation

Complete guide for testing the system locally and in production.

## Pre-Testing: Validate Your Setup

**Always do this first** to catch configuration issues early:

```bash
npm run validate:setup
```

This checks:
- ✅ All required environment variables are set
- ✅ Values are in correct format  
- ✅ Warnings for optional features (Airtable, Email)

If this fails, follow SETUP.md to configure missing variables.

## Local Testing Setup

### 1. Start the Development Server

```bash
npm install --legacy-peer-deps
export DATABASE_URL="file:./prisma/dev.db"
npm run db:migrate
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-direct.ts
npm run dev
```

Server starts at `http://localhost:3000`

### 2. Verify Server is Running

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-07-19T00:11:18.549Z",
  "version": "1.0.0"
}
```

**In the dev server logs, you should see:**
```
✓ Compiled successfully
```

### 3. Test Lead Submission

Send a new lead to the system:

```bash
curl -X POST http://localhost:3000/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith",
    "phone": "+1234567890",
    "serviceRequested": "Emergency AC Repair",
    "businessId": 1
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "recordId": 1,
  "textSent": true
}
```

**Check in dev server logs for:**
```
New lead received: John Smith (+1234567890) for Emergency AC Repair
[MOCK SMS] To: +1234567890, Message: Hi John Smith! Thanks for reaching out to...
```

### 4. Test Incoming Call Webhook

Test what caller hears when they call your number:

```bash
curl -X POST http://localhost:3000/api/webhooks/twilio/incoming-call \
  -d "From=%2B1234567890&CallSid=CA1234567890" \
  -H "Content-Type: application/x-www-form-urlencoded"
```

**Expected Response:** TwiML XML (voicemail greeting)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you for calling. We're not available right now. Please leave a message after the beep.</Say>
  <Record maxLength="120"/>
  <Say>Thank you for your message. We'll get back to you shortly.</Say>
  <Hangup/>
</Response>
```

### 5. Test Missed Call Detection

Simulate what happens when someone calls and you don't answer:

```bash
curl -X POST http://localhost:3000/api/webhooks/twilio/call-status \
  -d "CallStatus=no-answer&From=%2B1234567890&CallSid=CA1234567890&CallDuration=5" \
  -H "Content-Type: application/x-www-form-urlencoded"
```

**Expected Response:**
```json
{
  "success": true,
  "recordId": 1
}
```

**Check in dev server logs for:**
```
Call CA1234567890 status: no-answer, duration: 5s, from: +1234567890
[MOCK SMS] To: +1234567890, Message: Sorry we missed your call! Your Service Business...
```

**When is a call "missed"?**
- CallStatus is "no-answer" (went to voicemail)
- OR CallDuration < 20 seconds and CallStatus is "completed"

### 6. Test SMS Inbound (Customer Response)

When a customer replies to your SMS:

```bash
curl -X POST http://localhost:3000/api/webhooks/twilio/sms-inbound \
  -d "From=%2B1234567890&Body=Yes%20I%20need%20help&MessageSid=SM123456" \
  -H "Content-Type: application/x-www-form-urlencoded"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "SMS received"
}
```

**Check in dev server logs for:**
```
Incoming SMS from +1234567890: Yes I need help
```

## Production Testing (After Vercel Deployment)

### 1. Test Health

```bash
curl https://your-app.vercel.app/api/health
```

### 2. Test Lead Submission from External Service

You can test from any external service (Zapier, Make, custom form):

```bash
curl -X POST https://your-app.vercel.app/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "phone": "+1555987654",
    "serviceRequested": "Plumbing Installation",
    "businessId": 1
  }'
```

### 3. Monitor Logs in Vercel

```bash
vercel logs --project your-project-name --follow
```

### 4. Verify SMS Sent

Check your test phone for SMS messages from your Twilio number.

### 5. Check Airtable

Log in to Airtable and verify:
- New records appear in MissedCalls table
- New records appear in Leads table
- Timestamps and phone numbers are correct

### 6. Check Email Alerts

Verify that owner email received:
- New lead alerts
- Missed call alerts

## End-to-End Test Flow

### Scenario 1: Missed Call
1. Call your business Twilio number from your phone
2. Don't answer or wait for voicemail
3. Verify:
   - You receive an SMS back
   - Owner receives email alert
   - Record appears in database
   - Record appears in Airtable (if configured)

### Scenario 2: Lead Submission
1. Submit form to webhook with lead data
2. Verify:
   - Lead receives SMS confirmation within 60s
   - Owner receives email alert immediately
   - Record appears in database
   - Record appears in Airtable (if configured)

### Scenario 3: SMS Response
1. After receiving SMS from missed call or lead submission
2. Reply with a text message
3. Verify:
   - Response is captured in database
   - Status is updated to "Responded"
   - Airtable record is updated with response

## Debugging

### Enable Debug Logging

Set `DEBUG=*` environment variable:

```bash
DEBUG=* npm run dev
```

### Check Database Records

Use Prisma Studio:

```bash
npm run db:studio
```

Then navigate to:
- MissedCall table
- LeadSubmission table
- BusinessConfig table

### Check Twilio Logs

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to Logs → Debugger
3. View incoming/outgoing messages and calls

### Check Airtable API

Test Airtable API directly:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.airtable.com/v0/YOUR_BASE_ID/YOUR_TABLE_ID
```

## Load Testing

For production readiness, test with multiple concurrent leads:

```bash
# Use Apache Bench for load testing
ab -n 100 -c 10 -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","phone":"+15551234567","serviceRequested":"Test"}' \
  https://your-app.vercel.app/api/webhooks/lead-submission
```

Or use a tool like [k6](https://k6.io/):

```bash
k6 run load-test.js
```

## Common Issues & Solutions

### SMS Not Sending
- Check Twilio credentials are correct
- Verify phone number format (+1234567890)
- Check Twilio account has SMS credits

### Email Not Sending
- Verify EMAIL_USER and EMAIL_PASSWORD
- Check that "Less secure apps" is enabled for Gmail
- Or verify App Password is correct

### Airtable Not Logging
- Verify API key, Base ID, Table ID
- Check that table columns match expected names
- Review Airtable API documentation

### Webhooks Not Firing from Twilio
- Verify URL is public and accessible
- Check Twilio webhook configuration in console
- Verify signature verification (may need to disable in dev)

## Testing Checklist

- [ ] Health endpoint responds
- [ ] Lead submission webhook works
- [ ] SMS sent to lead
- [ ] Email sent to owner
- [ ] Database records created
- [ ] Airtable records created (if configured)
- [ ] Call status webhook processes missed calls
- [ ] Automatic SMS sent for missed calls
- [ ] Database transaction handling
- [ ] Error handling and logging
- [ ] Rate limiting (if needed)
- [ ] Signature verification works
