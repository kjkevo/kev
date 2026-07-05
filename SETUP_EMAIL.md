# Email Setup Guide - Complete Instructions

This guide walks you through configuring email to send alerts to business owners when new leads are submitted or important events occur.

**Alternative:** If you prefer not to use email, SMS-only mode is available (skip this guide)

---

## ✅ Prerequisites

- [ ] Email account created (Gmail, Outlook, or SMTP-compatible service)
- [ ] Email service selection (we'll use Gmail as the example)
- [ ] Basic understanding of email settings

---

## Step 1: Choose Your Email Service

### Option A: Gmail (Recommended for Testing)

**Why Gmail?**
- Free
- Easy setup with App Passwords
- Reliable delivery
- Good for small-medium volume

**Recommended for:** Most businesses starting out

### Option B: Custom SMTP Server

**Why Custom SMTP?**
- Full control
- Can use existing corporate email
- Better for high-volume sending

**Recommended for:** Enterprise deployments, existing email infrastructure

### Option C: SendGrid/AWS SES/Other Services

**Why?**
- Better deliverability at scale
- Better tracking and analytics
- Designed for transactional email

**Recommended for:** High-volume, production systems

---

## Step 2A: Set Up Gmail (Easy - Recommended)

### Part 1: Enable 2-Factor Authentication

Gmail now requires 2FA to use App Passwords. If you don't have it enabled:

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Click **2-Step Verification**
3. Follow the prompts to enable it
4. You'll receive verification codes via phone

**Estimated time:** 5 minutes

### Part 2: Generate Gmail App Password

1. Go to [Google Account App Passwords](https://myaccount.google.com/apppasswords)
2. You should see a dropdown at the top:
   - **Select app:** Choose "Mail" (or "Other (custom name)")
   - **Select device:** Choose "Windows Computer" (or your device)
3. Google will generate a 16-character password
4. **COPY THE PASSWORD** (you'll only see it once!)

**Example:**
```
Password: abcd efgh ijkl mnop
```

**Note:** Spaces are just for readability. When entering in .env.local, remove spaces.

### Part 3: Add to Environment Variables

1. Open `.env.local`
2. Add these lines:

```bash
# Email Configuration (Gmail)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop
EMAIL_FROM_NAME=Your Business Name
```

**Replace:**
- `your-email@gmail.com` with your actual Gmail address
- `abcdefghijklmnop` with your 16-character App Password (no spaces)
- `Your Business Name` with your business name

**Example:**
```bash
EMAIL_SERVICE=gmail
EMAIL_USER=owner@acmeplumbing.com
EMAIL_PASSWORD=abcdefghijklmnop
EMAIL_FROM_NAME=Acme Plumbing Co
```

---

## Step 2B: Set Up Custom SMTP

If you have your own email server or corporate email:

### Get SMTP Credentials

Ask your email provider for:
1. **SMTP Host** (e.g., `smtp.company.com`)
2. **SMTP Port** (usually 587 or 465)
3. **Username** (usually your full email)
4. **Password** (your email password or app password)
5. **Enable TLS/SSL** (yes, usually)

### Add to Environment Variables

```bash
# Email Configuration (Custom SMTP)
EMAIL_SERVICE=smtp
EMAIL_HOST=smtp.company.com
EMAIL_PORT=587
EMAIL_SECURE=true
EMAIL_USER=your-email@company.com
EMAIL_PASSWORD=your-password
EMAIL_FROM_NAME=Your Business Name
```

---

## Step 3: Test Email Configuration (Local)

### Test 1: Start Dev Server

```bash
npm run dev
```

### Test 2: Submit a Test Lead

```bash
curl -X POST http://localhost:3000/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "phone": "+15551234567",
    "serviceRequested": "Plumbing Repair",
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

### Test 3: Check Server Logs for Email

In your dev server console, look for:

```
Email config: { emailUser: 'owner@acmeplumbing.com', emailService: 'gmail' }
Sending email to: owner@acmeplumbing.com
Subject: 🔔 New Lead for Acme Plumbing Co
Email sent successfully
```

**What this proves:**
- ✅ Email configuration loaded
- ✅ Email transporter initialized
- ✅ Email sending attempted
- ✅ No authentication errors

### Test 4: Check Your Email Inbox

1. Check the email account you configured (e.g., owner@acmeplumbing.com)
2. You should see an email with:
   - **From:** your-email@gmail.com (or configured account)
   - **Subject:** 🔔 New Lead for Acme Plumbing Co
   - **Body:** Lead details (name, phone, service, timestamp)

**Example Email:**
```
To: owner@acmeplumbing.com
From: owner@acmeplumbing.com
Subject: 🔔 New Lead for Acme Plumbing Co

New Lead Submission
Business: Acme Plumbing Co
Name: John Doe
Phone: +15551234567
Service: Plumbing Repair
Timestamp: 2024-01-15 10:30:00 UTC

Reply to this email or call the customer back immediately.
```

**What this proves:**
- ✅ Email credentials working
- ✅ Email actually sent
- ✅ Email formatting correct
- ✅ Business name dynamically included

---

## Step 4: Test Missed Call Alerts (Optional)

When a missed call occurs, the business owner gets an email alert.

### Simulate Missed Call

```bash
curl -X POST http://localhost:3000/api/webhooks/twilio/call-status \
  -d "CallStatus=no-answer&From=%2B15551234567&CallSid=CA123&CallDuration=5"
```

### Check Email

You should receive an email with subject:
```
📞 Missed Call Alert from +15551234567
```

---

## Step 5: Deploy to Vercel

### Step 1: Commit Your Changes

```bash
git add .env.local
git commit -m "Add email configuration"
git push origin claude/missed-call-textback-6a4nxe
```

### Step 2: Add Environment Variables to Vercel

1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your project
3. Click **Settings** → **Environment Variables**
4. Add these variables:

**For Gmail:**
| Name | Value |
|------|-------|
| EMAIL_SERVICE | gmail |
| EMAIL_USER | your-email@gmail.com |
| EMAIL_PASSWORD | abcdefghijklmnop (16-char app password) |
| EMAIL_FROM_NAME | Your Business Name |

**For Custom SMTP:**
| Name | Value |
|------|-------|
| EMAIL_SERVICE | smtp |
| EMAIL_HOST | smtp.company.com |
| EMAIL_PORT | 587 |
| EMAIL_SECURE | true |
| EMAIL_USER | your-email@company.com |
| EMAIL_PASSWORD | your-password |
| EMAIL_FROM_NAME | Your Business Name |

5. Click **Save**

### Step 3: Deploy

```bash
vercel deploy --prod
```

### Step 4: Test Production

1. Submit a test lead:
```bash
curl -X POST https://your-app.vercel.app/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Test",
    "phone": "+15551234567",
    "serviceRequested": "Service",
    "businessId": 1
  }'
```

2. Check your email inbox (within 5 seconds)

3. You should see the alert email

---

## Troubleshooting Email

### Problem: "Gmail: Invalid Username"

**Fix:**
1. Verify Gmail address is correct
2. Check that 2FA is enabled
3. Generate a NEW App Password (old one may have expired)
4. Update .env.local with new password

### Problem: "Gmail: Too many login attempts"

**Fix:**
1. Gmail temporarily blocked login attempts
2. Wait 30 minutes
3. Try again
4. Use an [App Password](https://myaccount.google.com/apppasswords) instead of your regular password

### Problem: "SMTP: Connection refused"

**Fix:**
1. Verify SMTP host is correct
2. Check port number (587 for TLS, 465 for SSL)
3. Verify username and password
4. Check that TLS/SSL is enabled
5. Contact your email provider for correct settings

### Problem: "Email not arriving"

**Checklist:**
- [ ] Environment variables set in Vercel
- [ ] App Password generated (not regular password)
- [ ] Email address is correct
- [ ] Check spam/junk folder
- [ ] Check server logs for error message

**Debug:**
```bash
# In dev server, look for:
# "Email config: { ... }"
# "Sending email to: ..."
# "Error sending email:" (if there's an error)
```

### Problem: "AUTH failed - invalid credentials"

**Fix for Gmail:**
1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Delete the old password
3. Generate a new one
4. Copy without spaces: `abcdefghijklmnop`
5. Update in .env.local
6. Restart dev server

**Fix for SMTP:**
1. Verify username is email address (not just username)
2. Verify password doesn't have special characters requiring escaping
3. Try resetting password with email provider
4. Contact provider to verify SMTP settings

### Problem: "Email sent but no content"

**Issue:** Email body is empty

**Fix:**
1. Check server logs for template rendering error
2. Verify {NAME} and {BUSINESS_NAME} are being replaced
3. Check that businessId exists in database

---

## Verification Checklist

```
EMAIL SETUP
☐ Email service chosen (Gmail/SMTP/Other)
☐ Credentials obtained
☐ 2FA enabled (for Gmail)
☐ App Password generated (for Gmail)

LOCAL TESTING
☐ .env.local has EMAIL_* variables
☐ npm run dev starts
☐ Submit test lead via curl
☐ Email received within 5 seconds
☐ Email contains business name
☐ Email subject correct

PRODUCTION
☐ Environment variables added to Vercel
☐ Vercel deployment successful
☐ Submit test lead via curl to production URL
☐ Email received within 10 seconds
☐ Email subject correct
☐ Business name dynamic (not hardcoded)
```

---

## Multi-Business Email Configuration

Each business can have its own email recipient:

### Option 1: One Email, Multiple Businesses

All alerts go to the same email:
```bash
EMAIL_USER=general@company.com
```

All businesses will send alerts to this email.

### Option 2: Separate Email per Business (Advanced)

Store email in BusinessConfig table:

In database:
```
Business 1: owner@acmeplumbing.com
Business 2: owner@superiorhvac.com
Business 3: owner@quickelectric.com
```

Code will route each to the correct owner email.

This requires:
1. Email credentials stored in database (encrypted)
2. Dynamic email initialization per business
3. More complex setup

**For now**, use Option 1 (single email account for all alerts).

---

## Quick Reference

### Gmail Setup (5 minutes)
```bash
# 1. Enable 2FA: https://myaccount.google.com/security
# 2. Generate App Password: https://myaccount.google.com/apppasswords
# 3. Add to .env.local:
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop
EMAIL_FROM_NAME=Your Business
```

### SMTP Setup (10 minutes)
```bash
# Get from email provider, then add:
EMAIL_SERVICE=smtp
EMAIL_HOST=smtp.company.com
EMAIL_PORT=587
EMAIL_SECURE=true
EMAIL_USER=your-email@company.com
EMAIL_PASSWORD=your-password
EMAIL_FROM_NAME=Your Business
```

### Test Locally
```bash
npm run dev
curl -X POST http://localhost:3000/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","phone":"+15551234567","serviceRequested":"Service","businessId":1}'
```

### Deploy to Vercel
```bash
git push origin claude/missed-call-textback-6a4nxe
# Add env vars in Vercel dashboard
vercel deploy --prod
```

---

## Email Event Types

Your system sends emails for:

### 1. New Lead Submission
- **Recipient:** Business owner (from config)
- **Trigger:** Lead submitted via webhook
- **Delay:** Immediate (< 1 second)
- **Subject:** 🔔 New Lead for [Business Name]

### 2. Missed Call Alert
- **Recipient:** Business owner
- **Trigger:** Call missed (no-answer or short duration)
- **Delay:** Within 5 seconds of call end
- **Subject:** 📞 Missed Call Alert from [Caller Number]

### 3. Lead Response Alert (Optional)
- **Recipient:** Business owner
- **Trigger:** Customer replies to SMS
- **Delay:** Immediate
- **Subject:** ✉️ Customer Response from [Customer Name]

---

## Next Steps

1. ✅ Configure email service (this guide)
2. Proceed to [SETUP_VERCEL.md](SETUP_VERCEL.md) for production deployment
3. Or configure alternate hosting: [SETUP_RAILWAY.md](SETUP_RAILWAY.md)

---

**Status: Email Setup Complete ✅**

Business owner alerts are now configured. Next: Deploy to production.
