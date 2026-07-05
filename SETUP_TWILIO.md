# Twilio Setup Guide - Complete Instructions

This guide walks you through configuring Twilio to work with the missed call text-back system.

---

## ✅ Prerequisites

You should already have:
- [ ] Twilio account created (sign up at twilio.com)
- [ ] Twilio phone number purchased
- [ ] Account SID and Auth Token
- [ ] $$ in your Twilio account (at least $15 for testing)

---

## Step 1: Get Your Twilio Credentials

### Find Your Account SID and Auth Token

1. Go to [Twilio Console](https://console.twilio.com/)
2. You'll see your **Account SID** and **Auth Token** on the dashboard
3. Click the eye icon next to Auth Token to reveal it
4. **COPY BOTH** (you'll need them)

**Example (format, not real credentials):**
```
Account SID: your_account_sid_here
Auth Token:  your_auth_token_here
```

### Find Your Twilio Phone Number

1. Go to [Phone Numbers](https://console.twilio.com/us/account/phone-numbers/incoming)
2. Click on your number to open settings
3. Copy the number (format: +1234567890)

**Example:**
```
Phone Number: +12025551234
```

---

## Step 2: Update Environment Variables

Add your Twilio credentials to `.env.local`:

```bash
# Copy your values from Twilio Console
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+12025551234
```

**Save the file!**

---

## Step 3: Configure Twilio Webhooks

This is the critical step. Twilio needs to know where to send incoming calls and SMS.

### Part A: Configure Incoming Call Webhook

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers** → **Manage Numbers**
3. Click on your phone number
4. Scroll down to **Voice & Fax** section
5. Find "A Call Comes In" setting
6. Select **Webhook** (if not already selected)
7. Enter this URL:
   ```
   https://your-app.vercel.app/api/webhooks/twilio/incoming-call
   ```
   Or for local testing:
   ```
   http://localhost:3000/api/webhooks/twilio/incoming-call
   ```
8. Select **POST** (from dropdown)
9. Click **Save**

**Screenshot checklist:**
- ☐ "A Call Comes In" is set to "Webhook"
- ☐ URL field contains your deployment URL
- ☐ Method is "POST"

### Part B: Configure Call Status Webhook

Still in the same phone number settings:

1. Scroll down to find **Call Status Changes** (below Voice section)
2. Select **Webhook** 
3. Enter this URL:
   ```
   https://your-app.vercel.app/api/webhooks/twilio/call-status
   ```
   Or for local testing:
   ```
   http://localhost:3000/api/webhooks/twilio/call-status
   ```
4. Select **POST**
5. Click **Save**

**Screenshot checklist:**
- ☐ "Call Status Changes" is set to "Webhook"
- ☐ URL field contains your deployment URL
- ☐ Method is "POST"

### Part C: Configure SMS Inbound Webhook

Still in the same phone number settings:

1. Scroll down to **Messaging** section
2. Find "A Message Comes In" setting
3. Select **Webhook**
4. Enter this URL:
   ```
   https://your-app.vercel.app/api/webhooks/twilio/sms-inbound
   ```
   Or for local testing:
   ```
   http://localhost:3000/api/webhooks/twilio/sms-inbound
   ```
5. Select **POST**
6. Click **Save**

**Screenshot checklist:**
- ☐ "A Message Comes In" is set to "Webhook"
- ☐ URL field contains your deployment URL
- ☐ Method is "POST"

---

## Step 4: Test Twilio Connection (Local)

### Test 1: Start Your Dev Server

```bash
npm run dev
```

**You should see:**
```
✓ Ready in 1234ms
```

### Test 2: Call Your Twilio Number

1. Call your Twilio phone number from your personal phone
2. Wait 2-3 seconds
3. You should hear: **"Thank you for calling. We're not available right now. Please leave a message after the beep."**
4. Optionally leave a message
5. You should hear: **"Thank you for your message. We'll get back to you shortly."**
6. Call ends

**What this proves:**
- ✅ Twilio is calling your webhook
- ✅ Your server is responding with TwiML
- ✅ Voicemail message playing

### Test 3: Check Server Logs

In your dev server console, you should see:

```
Incoming call from +15551234567, CallSid: CA1234567890abcdef1234567890abcdef
```

**What this proves:**
- ✅ Webhook received the incoming call
- ✅ Phone number captured
- ✅ Call SID logged

### Test 4: Wait for Call Status Webhook

After the call ends (within 5 seconds), you should see:

```
Call CA1234567890abcdef1234567890abcdef status: completed, duration: 15s, from: +15551234567
Processed missed call CA1234567890abcdef1234567890abcdef, text status: sent
```

**What this proves:**
- ✅ Call status webhook received
- ✅ Missed call detected (duration < 20s)
- ✅ SMS attempted to send

### Test 5: Check Database

```bash
npm run db:studio
# Navigate to MissedCall table
# You should see a new record
```

**Expected record:**
| id | businessId | callerPhone | missedAt | textStatus |
|----|---|---|---|---|
| 1 | 1 | +15551234567 | 2024-01-15 10:30:00 | sent |

**What this proves:**
- ✅ Database record created
- ✅ Phone number captured
- ✅ Text status logged

---

## Step 5: Test SMS Sending (Local)

The SMS won't actually send in local development unless you have email/SMS service configured, but we can verify the system is set up correctly.

### Test 1: Trigger a Missed Call
```bash
# Let call go to voicemail (don't answer)
# System will try to send SMS
```

### Test 2: Check Logs for SMS Attempt

In dev server logs, you should see:

```
Error sending SMS: Missing Twilio credentials
```

Or if configured:

```
SMS sent successfully with SID: SM1234567890abcdef1234567890abcdef
```

**What this proves:**
- ✅ SMS service is configured
- ✅ Message body is prepared
- ✅ Attempt logged

---

## Step 6: Test with Lead Submission

Test that SMS works when a new lead is submitted.

### Test 1: Submit a Test Lead

```bash
curl -X POST http://localhost:3000/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Customer",
    "phone": "+15551234567",
    "serviceRequested": "Test Service",
    "businessId": 1
  }'
```

**Expected response:**
```json
{
  "success": true,
  "recordId": 42,
  "textSent": true
}
```

### Test 2: Check Logs

You should see:

```
New lead received: Test Customer (+15551234567) for Test Service
Sending SMS to +15551234567
```

### Test 3: Check Database

```bash
npm run db:studio
# Navigate to LeadSubmission table
# You should see new record
```

---

## Step 7: Deploy to Vercel

Once local testing works, deploy to production.

### Step 1: Commit Your Changes

```bash
git add .
git commit -m "Update Twilio credentials"
git push origin claude/missed-call-textback-6a4nxe
```

### Step 2: Deploy to Vercel

```bash
vercel deploy --prod
```

**You'll get a URL like:**
```
✓ Production: https://missed-call-textback-6a4nxe.vercel.app
```

### Step 3: Update Twilio Webhooks for Production

1. Go back to [Twilio Console](https://console.twilio.com/)
2. Phone Numbers → Manage Numbers → Your Number
3. Update all three webhook URLs to use your Vercel URL:

**Replace:**
```
http://localhost:3000
```

**With:**
```
https://missed-call-textback-6a4nxe.vercel.app
```

**Final URLs should be:**
- A Call Comes In: `https://missed-call-textback-6a4nxe.vercel.app/api/webhooks/twilio/incoming-call`
- Call Status Changes: `https://missed-call-textback-6a4nxe.vercel.app/api/webhooks/twilio/call-status`
- A Message Comes In: `https://missed-call-textback-6a4nxe.vercel.app/api/webhooks/twilio/sms-inbound`

4. Click **Save**

### Step 4: Add Environment Variables to Vercel

1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your project
3. Click **Settings** → **Environment Variables**
4. Add these variables:

| Name | Value |
|------|-------|
| TWILIO_ACCOUNT_SID | AC1234567890... |
| TWILIO_AUTH_TOKEN | 1234567890... |
| TWILIO_PHONE_NUMBER | +12025551234 |
| DATABASE_URL | postgresql://... |
| DIRECT_URL | postgresql://... |
| BUSINESS_NAME | Your Business |
| BUSINESS_OWNER_PHONE | +1234567890 |
| BUSINESS_OWNER_EMAIL | owner@yourbiz.com |
| EMAIL_SERVICE | gmail |
| EMAIL_USER | your-email@gmail.com |
| EMAIL_PASSWORD | app_password |

5. Click **Save**

### Step 5: Test Production

```bash
curl -X POST https://missed-call-textback-6a4nxe.vercel.app/api/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0"
}
```

### Step 6: Call Your Number Again

1. Call your Twilio phone number from your phone
2. Should work exactly like local testing
3. SMS should send to your business owner phone
4. Database record should be created

---

## Troubleshooting Twilio

### Problem: "I call but nothing happens"

**Checklist:**
- [ ] Twilio account has credit ($$ balance)
- [ ] Phone number is active in Twilio
- [ ] Webhook URLs are correct (no typos)
- [ ] Webhook URLs are publicly accessible (not localhost in production)
- [ ] Server is running (`npm run dev` or deployed)
- [ ] Firewall allows inbound from Twilio IPs

**Fix:**
1. Check Twilio balance: [Billing](https://console.twilio.com/us/account/billing/overview)
2. Check phone number status: [Phone Numbers](https://console.twilio.com/us/account/phone-numbers/incoming)
3. Check webhook logs: [Twilio Debugger](https://console.twilio.com/us/account/logs/debugger)

### Problem: "SMS not sending"

**Checklist:**
- [ ] Twilio has SMS credit
- [ ] Phone numbers in E.164 format (+1234567890)
- [ ] Email configured correctly
- [ ] Twilio credentials correct

**Fix:**
```bash
# Check Twilio logs
# Go to: Console → Logs → Message Logs
# Look for errors
```

### Problem: "Webhook returns 403"

**Issue:** Twilio signature verification failing

**Fix:**
```bash
# For development, disable verification
# Set in .env.local:
NODE_ENV=development

# For production, ensure auth token is correct
TWILIO_AUTH_TOKEN=your_actual_token
```

### Problem: "No callback from Twilio"

**Checklist:**
- [ ] URL is HTTPS (not HTTP in production)
- [ ] URL is publicly accessible
- [ ] Server is running
- [ ] Firewall not blocking

**Fix:**
```bash
# Test URL from command line
curl https://your-app.vercel.app/api/health
# Should return 200 OK
```

---

## Verification Checklist

Print this and check off as you go:

```
CREDENTIALS
☐ Account SID copied
☐ Auth Token copied
☐ Phone number copied

LOCAL TESTING
☐ .env.local has credentials
☐ npm run dev starts
☐ Call your number → hear voicemail
☐ Server logs show incoming call
☐ Server logs show call status
☐ Database shows MissedCall record

WEBHOOK CONFIGURATION
☐ Incoming Call webhook configured
☐ Call Status webhook configured
☐ SMS Inbound webhook configured
☐ All URLs correct
☐ All methods set to POST

PRODUCTION DEPLOYMENT
☐ Code deployed to Vercel
☐ Environment variables added
☐ Twilio webhooks updated with Vercel URL
☐ /api/health responds 200 OK
☐ Call your number → works
☐ SMS sends
☐ Database records created

FINAL TEST
☐ Submit lead via API
☐ Record appears in database
☐ SMS would be sent (check logs)
☐ Email would be sent (check logs)
```

---

## Quick Reference

### Twilio Console Links
- [Account Dashboard](https://console.twilio.com/)
- [Phone Numbers](https://console.twilio.com/us/account/phone-numbers/incoming)
- [Message Logs](https://console.twilio.com/us/account/logs/messages)
- [Debugger](https://console.twilio.com/us/account/logs/debugger)
- [Billing](https://console.twilio.com/us/account/billing/overview)

### Webhook URLs (Replace with your URL)
```
Incoming Call:
https://your-app.vercel.app/api/webhooks/twilio/incoming-call

Call Status:
https://your-app.vercel.app/api/webhooks/twilio/call-status

SMS Inbound:
https://your-app.vercel.app/api/webhooks/twilio/sms-inbound
```

### Test Commands
```bash
# Health check
curl https://your-app.vercel.app/api/health

# Submit lead
curl -X POST https://your-app.vercel.app/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","phone":"+15551234567","serviceRequested":"Test","businessId":1}'

# Check logs
vercel logs --follow
```

---

**Status: Twilio Setup Complete ✅**

You can now receive calls and send SMS. Move to the next setup guide: Airtable or Google Sheets.
