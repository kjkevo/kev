# Setup Guide: Missed Call Text-Back Automation

This guide walks you through setting up the missed call text-back automation system for your service business. The entire setup takes about 30-45 minutes.

## Overview

This system automatically:
- Sends a text to customers when they miss your call
- Logs all missed calls and leads
- Sends email alerts to you when new leads come in
- Confirms receipt to customers via SMS

## Prerequisites

- A Twilio account (free trial available)
- An Airtable account (free tier works)
- A Gmail account (or other email provider for notifications)
- A Vercel account (free, for hosting)
- A Supabase account (free tier available)

## Step 1: Create Twilio Account & Get Phone Number

1. Go to [twilio.com](https://www.twilio.com/console) and create an account
2. In the Twilio Console, go to **Phone Numbers** → **Manage** → **Buy a number**
3. Choose a number for your service area
4. Note down:
   - **Account SID** (from Account Info at top)
   - **Auth Token** (from Account Info at top)
   - **Phone Number** (the number you just bought, e.g., +1234567890)

> ⚠️ Keep your Account SID and Auth Token private! Never commit them to git.

## Step 2: Configure Twilio Webhooks

1. In Twilio Console, go to **Phone Numbers** → **Manage** → **Active Numbers**
2. Click on your phone number
3. Under **Voice**, set:
   - **Configure with**: Webhooks/TwiML
   - **A call comes in**: POST to `https://your-domain.com/api/webhooks/twilio/incoming-call`
4. Under **Messaging**, set:
   - **A message comes in**: POST to `https://your-domain.com/api/webhooks/twilio/sms-inbound`
5. Save

> Note: You'll get `your-domain.com` after deployment to Vercel (Step 5)

## Step 3: Set Up Airtable (Optional but Recommended)

Airtable logs all your missed calls and leads in a spreadsheet-like interface.

1. Go to [airtable.com](https://airtable.com) and create an account
2. Create a new base called "Business Calls"
3. Create two tables:
   - **Missed Calls** with fields:
     - Name, Phone, Business, Timestamp, Type, Status, MissedAt
   - **Leads** with fields:
     - Name, Phone, Business, Service, Timestamp, Type, Status
4. Get your API key:
   - Go to [airtable.com/account](https://airtable.com/account)
   - Click **Generate API key**
   - Copy the key
5. Get your Base ID:
   - In your base, go to Help → API documentation
   - Find "Base ID" in the URL section
6. Get your Table IDs:
   - Same API docs page, find your table names and their IDs

Note down:
- **AIRTABLE_API_KEY**
- **AIRTABLE_BASE_ID**
- **AIRTABLE_MISSED_CALLS_TABLE_ID**
- **AIRTABLE_LEADS_TABLE_ID**

## Step 4: Set Up Email Notifications

### Using Gmail (Recommended)

1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Select "Mail" and "Windows Computer" (or your device)
3. Google will generate a 16-character password
4. Note down:
   - **EMAIL_USER**: Your Gmail address (e.g., owner@gmail.com)
   - **EMAIL_PASSWORD**: The 16-character password

### Using Another Email Provider

Contact your email provider for SMTP credentials. You'll need:
- SMTP server address
- SMTP port
- Email username
- Email password

## Step 5: Set Up Supabase (Production Database)

1. Go to [supabase.com](https://supabase.com) and sign up
2. Create a new project:
   - Name: "business-calls" or similar
   - Choose your region (closest to you)
3. Wait for project to initialize
4. Go to **Project Settings** → **Database**
5. Copy your **Connection String** (PostgreSQL)
6. Note down:
   - **DATABASE_URL**: Your Supabase connection string

## Step 6: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up
2. Click "Add New" → "Project"
3. Select your GitHub repository (`kjkevo/kev`)
4. Configure environment variables:
   - Click "Environment Variables"
   - Add all variables from Step 1-5 (see below)
5. Click "Deploy"
6. Wait for deployment to complete
7. Note your domain (e.g., `business-calls.vercel.app`)

### Environment Variables to Add in Vercel

Go to your Vercel project settings and add these:

```
# Database
DATABASE_URL=your-supabase-connection-string

# Twilio
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Business Info
BUSINESS_NAME=Your Business Name
BUSINESS_OWNER_PHONE=+1234567890
BUSINESS_OWNER_EMAIL=owner@example.com

# Messages (optional, use defaults)
MISSED_CALL_MESSAGE=Sorry we missed your call! {BUSINESS_NAME} will call you back shortly. Reply here if you'd like to send details now.
LEAD_SUBMISSION_MESSAGE=Hi {NAME}! Thanks for reaching out to {BUSINESS_NAME}. We got your message and will reply shortly.

# Email
EMAIL_SERVICE=gmail
EMAIL_USER=owner@gmail.com
EMAIL_PASSWORD=your-app-password

# Airtable (optional)
AIRTABLE_API_KEY=your-api-key
AIRTABLE_BASE_ID=your-base-id
AIRTABLE_MISSED_CALLS_TABLE_ID=your-table-id
AIRTABLE_LEADS_TABLE_ID=your-table-id

# NextAuth (for existing features)
NEXTAUTH_SECRET=generate-random-string-here
NEXTAUTH_URL=https://your-domain.vercel.app
```

## Step 7: Update Twilio Webhooks with Your Domain

Now that you have your Vercel domain, go back to Twilio and update the webhook URLs:

1. Twilio Console → Phone Numbers → Active Numbers → Your Number
2. Update Voice webhook to: `https://your-domain.vercel.app/api/webhooks/twilio/incoming-call`
3. Update Messaging webhook to: `https://your-domain.vercel.app/api/webhooks/twilio/sms-inbound`
4. Save

## Step 8: Create Business Config in Database

The system needs to know about your business. Run this command:

```bash
export DATABASE_URL="your-supabase-connection-string"
npx ts-node prisma/seed-direct.ts
```

Or use Supabase Studio to insert a record into the `BusinessConfig` table:
- businessName: Your Business Name
- businessPhone: Your Twilio number
- ownerPhone: Your phone
- ownerEmail: Your email
- Other fields: Leave as default

## Step 9: Test the Setup

### Test 1: Health Check

```bash
curl https://your-domain.vercel.app/api/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2026-07-19T00:11:18.549Z",
  "version": "1.0.0"
}
```

### Test 2: Lead Submission

```bash
curl -X POST https://your-domain.vercel.app/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Customer",
    "phone": "+1234567890",
    "serviceRequested": "Test Service",
    "businessId": 1
  }'
```

Should return:
```json
{
  "success": true,
  "recordId": 1,
  "textSent": true
}
```

You should receive:
- SMS to your phone (if Twilio is configured)
- Email notification (if email is configured)
- Entry in Airtable (if configured)

### Test 3: Incoming Call Webhook

To simulate an incoming call, use a tool like Postman or:

```bash
curl -X POST https://your-domain.vercel.app/api/webhooks/twilio/incoming-call \
  -d "From=%2B1234567890&CallSid=CA12345678" \
  -H "Content-Type: application/x-www-form-urlencoded"
```

Should return TwiML voicemail response.

### Test 4: Missed Call Webhook

```bash
curl -X POST https://your-domain.vercel.app/api/webhooks/twilio/call-status \
  -d "CallStatus=no-answer&From=%2B1234567890&CallSid=CA12345678&CallDuration=5" \
  -H "Content-Type: application/x-www-form-urlencoded"
```

Should return:
```json
{
  "success": true,
  "recordId": 1
}
```

## Troubleshooting

### "Not authorized" error from Airtable
- Check your API key is correct
- Verify the table IDs match your base

### SMS not being sent
- Verify Twilio credentials in environment variables
- Check Twilio account has enough credits
- In development, SMS shows as "[MOCK SMS]" in logs

### Email not being sent
- Verify Gmail app password is correct (not your regular password)
- Check EMAIL_USER is set to your Gmail address
- In development, email shows as mocked in logs

### Webhook not being called by Twilio
- Verify webhook URLs are correct in Twilio Console
- Check Vercel logs for errors
- Ensure HTTPS is used (not HTTP)

## Next Steps

1. **Test with real calls**: Have a friend call your Twilio number
2. **Monitor Airtable**: Check that calls/leads appear in your base
3. **Set up additional numbers**: Add more Twilio numbers for different locations
4. **Customize messages**: Update MISSED_CALL_MESSAGE and LEAD_SUBMISSION_MESSAGE with your business voice

## Support

For issues:
1. Check the Troubleshooting section above
2. Review Vercel deployment logs
3. Check Twilio console for webhook delivery status
4. Verify all environment variables are set correctly

---

Questions? This system is built with Next.js, Twilio, Airtable, and Supabase. Each service has excellent documentation if you need to dive deeper.
