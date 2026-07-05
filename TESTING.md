# Testing the Missed Call Text-Back Automation

This guide shows how to test the missed call automation system locally and in production.

## Local Testing Setup

### 1. Start the Development Server

```bash
npm install
npm run db:migrate  # Run database migration
npm run dev
```

The server will start at `http://localhost:3000`

### 2. Test Health Endpoint

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0"
}
```

### 3. Test Lead Submission

```bash
curl -X POST http://localhost:3000/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith",
    "phone": "+15551234567",
    "serviceRequested": "Emergency AC Repair"
  }'
```

Expected response:
```json
{
  "success": true,
  "recordId": 1,
  "textSent": true
}
```

### 4. Test Call Status Webhook (Missed Call)

```bash
curl -X POST http://localhost:3000/api/webhooks/twilio/call-status \
  -d "CallStatus=no-answer&From=%2B15551234567&CallSid=CA1234567890&CallDuration=5"
```

Expected response:
```json
{
  "success": true,
  "recordId": 1
}
```

### 5. Test Incoming Call Webhook

```bash
curl -X POST http://localhost:3000/api/webhooks/twilio/incoming-call \
  -d "From=%2B15551234567&CallSid=CA1234567890"
```

Expected response: XML (TwiML)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you for calling. We're not available right now. Please leave a message after the beep.</Say>
  <Record maxLength="120"/>
</Response>
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
