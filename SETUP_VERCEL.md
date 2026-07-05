# Vercel Deployment Setup Guide - Complete Instructions

This guide walks you through deploying your missed call text-back automation system to Vercel for production use.

**Alternative:** For other hosting providers, see [SETUP_RAILWAY.md](SETUP_RAILWAY.md)

---

## ✅ Prerequisites

Before deploying, you should have:
- [ ] GitHub account with repository
- [ ] Vercel account (free at vercel.com)
- [ ] All configuration completed:
  - [ ] Twilio credentials (SETUP_TWILIO.md)
  - [ ] Airtable or database setup (SETUP_AIRTABLE.md or database)
  - [ ] Email configured (SETUP_EMAIL.md)
- [ ] Code committed to GitHub (main branch)
- [ ] All environment variables documented

---

## Step 1: Prepare Your Repository

### Step 1A: Ensure Code is Committed

First, make sure all your code is committed to GitHub:

```bash
cd /home/user/kev
git status
```

You should see:
```
On branch claude/missed-call-textback-6a4nxe
nothing to commit, working tree clean
```

If there are uncommitted changes:
```bash
git add .
git commit -m "Final code before deployment"
git push origin claude/missed-call-textback-6a4nxe
```

### Step 1B: Switch to Main Branch (for deployment)

```bash
git checkout main
git pull origin main
```

**Note:** You typically deploy from `main` or `master` branch. If you've been working on a feature branch, merge it first:

```bash
git merge claude/missed-call-textback-6a4nxe
git push origin main
```

---

## Step 2: Create Vercel Account (if needed)

### If You Don't Have Vercel Yet:

1. Go to [Vercel.com](https://vercel.com)
2. Click **Sign Up**
3. Choose **GitHub** (to authorize)
4. Authorize Vercel to access your GitHub account
5. Select your repository

### If You Already Have Vercel:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Verify your GitHub is connected

---

## Step 3: Import Project into Vercel

### Option A: Using Vercel CLI (Recommended)

**Install Vercel CLI:**
```bash
npm i -g vercel
```

**Login:**
```bash
vercel login
# Opens browser to authorize
# Follow prompts
```

**Deploy:**
```bash
cd /home/user/kev
vercel
```

**You'll see:**
```
? Set up and deploy "kev"? [Y/n] y
? Which scope do you want to deploy to? your-username
? Linked to your-vercel-org/kev (created .vercel)
? Auto-confirm for all prompts? [y/N] N
```

Just press Enter to accept defaults.

**Result:**
```
✓ Preview: https://kev-git-main-your-username.vercel.app
✓ Production: https://kev.vercel.app
```

**Your preview/production URLs will be displayed.**

### Option B: Using Vercel Web Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New Project**
3. Select your GitHub repository
4. Click **Import**
5. Configure (see Step 4 below)
6. Click **Deploy**

---

## Step 4: Configure Environment Variables in Vercel

### Step 4A: Access Environment Variables

1. In [Vercel Dashboard](https://vercel.com/dashboard)
2. Click your project name (`kev`)
3. Click **Settings** tab
4. Click **Environment Variables** (left sidebar)

### Step 4B: Add All Required Variables

You need to add every variable from your `.env.local` file (except DATABASE_URL which should already be there).

**Copy each variable from your `.env.local` and add to Vercel:**

#### Twilio Variables
```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```

#### Airtable Variables (if using Airtable)
```
AIRTABLE_API_KEY=pat...
AIRTABLE_BASE_ID=app...
AIRTABLE_MISSED_CALLS_TABLE_ID=tbl...
AIRTABLE_LEADS_TABLE_ID=tbl...
```

#### Email Variables
```
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop
EMAIL_FROM_NAME=Your Business Name
```

#### Business Configuration
```
BUSINESS_NAME=Your Business
BUSINESS_OWNER_PHONE=+1...
BUSINESS_OWNER_EMAIL=owner@yourbiz.com
```

#### Database (Should already exist)
```
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
```

#### Webhook Configuration
```
WEBHOOK_URL=https://your-vercel-app.vercel.app
```

**For each variable:**
1. Click **Add New**
2. Enter **Name** (e.g., `TWILIO_ACCOUNT_SID`)
3. Enter **Value** (e.g., `AC...`)
4. Select environments: **Production** and **Preview** (check both)
5. Click **Add**

### Step 4C: Verify All Variables Added

Before deploying, verify:
```bash
# In Vercel dashboard, you should see:
☐ TWILIO_ACCOUNT_SID
☐ TWILIO_AUTH_TOKEN
☐ TWILIO_PHONE_NUMBER
☐ AIRTABLE_API_KEY (if using)
☐ AIRTABLE_BASE_ID (if using)
☐ AIRTABLE_MISSED_CALLS_TABLE_ID (if using)
☐ AIRTABLE_LEADS_TABLE_ID (if using)
☐ EMAIL_SERVICE
☐ EMAIL_USER
☐ EMAIL_PASSWORD
☐ EMAIL_FROM_NAME
☐ BUSINESS_NAME
☐ BUSINESS_OWNER_PHONE
☐ BUSINESS_OWNER_EMAIL
☐ DATABASE_URL
☐ DIRECT_URL
```

---

## Step 5: Deploy to Vercel

### Using Vercel CLI

```bash
vercel deploy --prod
```

### Or Using Web Dashboard

1. Go to **Deployments** tab
2. Click the latest deployment
3. Click **Promote to Production** (if not already promoted)

### Watch Deployment Progress

You'll see:
```
Vercel CLI 34.1.0
✓ Linked to your-username/kev (created .vercel)
✓ Inspected 47 files in /home/user/kev
✓ Handled 25 files in 123ms
✓ Building...

Next.js Build Output
...compiling...

✓ Production: https://kev.vercel.app [in 45s]
```

**Deployment complete when you see the production URL!**

---

## Step 6: Test Production Deployment

### Test 1: Health Check

```bash
curl https://your-app.vercel.app/api/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

**What this proves:**
- ✅ Vercel deployment successful
- ✅ Next.js server running
- ✅ API endpoints accessible

### Test 2: Submit Test Lead

```bash
curl -X POST https://your-app.vercel.app/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Test",
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

**What this proves:**
- ✅ API routes working
- ✅ Database connection working
- ✅ SMS sending attempted
- ✅ Webhook configuration correct

### Test 3: Verify Database Record

```bash
npm run db:studio
# Navigate to LeadSubmission table
# Should show new record from production test
```

### Test 4: Verify Email Sent

Check the business owner email inbox (within 10 seconds):
- Should receive email with subject "🔔 New Lead for [Business]"
- Email contains: name, phone, service

### Test 5: Verify Airtable Updated (if using)

1. Go to your Airtable base
2. Click **Leads** table
3. Refresh page (Cmd+R)
4. Should see new record from production test

---

## Step 7: Update Twilio Webhooks for Production

Now that your app is deployed, update Twilio to use your production URL.

### Update Twilio Webhook URLs

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers** → **Manage Numbers**
3. Click on your phone number
4. Update three webhook URLs:

**Replace:**
```
http://localhost:3000
```

**With:**
```
https://your-app.vercel.app
```

**Final URLs:**
- A Call Comes In: `https://your-app.vercel.app/api/webhooks/twilio/incoming-call`
- Call Status Changes: `https://your-app.vercel.app/api/webhooks/twilio/call-status`
- A Message Comes In: `https://your-app.vercel.app/api/webhooks/twilio/sms-inbound`

5. Click **Save**

---

## Step 8: Run Full Production Test

### Call Your Twilio Number

1. Call your Twilio phone number from any phone
2. You should hear the voicemail greeting
3. Leave a message (or just hang up)
4. Wait 5 seconds

### Check Results

**Verify in database:**
```bash
npm run db:studio
# MissedCall table should have new record
```

**Verify in Airtable (if configured):**
```
1. Go to Airtable base
2. Click Missed Calls table
3. Should see new record
```

**Verify email sent:**
```
1. Check business owner email inbox
2. Should see alert: "📞 Missed Call Alert from +1..."
```

---

## Step 9: Monitor Production Deployment

### Enable Vercel Monitoring

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click your project
3. Click **Monitoring** tab
4. You'll see:
   - Response times
   - Error rates
   - Deployment history

### View Logs

```bash
# View live production logs
vercel logs --follow

# Or view in dashboard:
# Project → Deployments → Click deployment → Logs
```

### Common Production Patterns

```
✓ 200 GET /api/health
✓ 201 POST /api/webhooks/twilio/incoming-call
✓ 200 POST /api/webhooks/twilio/call-status
✓ 200 POST /api/webhooks/lead-submission
✗ 500 Error: Database connection failed
```

If you see 500 errors, check:
1. Database URL is correct
2. Database is running
3. Firewall allows Vercel IPs
4. Check logs for error details

### Alert Setup (Optional)

1. Click **Settings**
2. **Notifications** → **Email**
3. Choose what alerts you want:
   - [ ] Failed deployments
   - [ ] Build warnings
   - [ ] Error thresholds exceeded

---

## Troubleshooting Vercel Deployment

### Problem: Build fails with "Cannot find module"

**Fix:**
1. Ensure `package.json` has all dependencies
2. Run locally: `npm install`
3. Run build: `npm run build`
4. Commit and push changes
5. Re-deploy: `vercel deploy --prod`

### Problem: Environment variables not loaded

**Fix:**
1. Verify variables added to **Settings** → **Environment Variables**
2. Ensure selected **Production** and **Preview**
3. Re-deploy: `vercel deploy --prod`
4. Check logs: `vercel logs --follow`

### Problem: API endpoints return 404

**Fix:**
1. Verify file paths match exactly:
   - `app/api/health/route.ts`
   - `app/api/webhooks/twilio/incoming-call/route.ts`
2. Rebuild locally: `npm run build`
3. Deploy: `vercel deploy --prod`

### Problem: Database connection fails in production

**Fix:**
1. Verify DATABASE_URL is set in Vercel environment
2. Check that database allows connections from Vercel IPs
3. If using Supabase: Add Vercel IP allowlist:
   - Go to Supabase dashboard
   - Project settings → Networking
   - Add Vercel IP range
4. Test connection: Check logs with `vercel logs --follow`

### Problem: SMS not sending in production

**Fix:**
1. Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in Vercel
2. Check Twilio account has credit
3. Check Twilio logs: [Console → Logs → Message Logs](https://console.twilio.com/us/account/logs/messages)
4. Verify phone numbers in E.164 format (+1234567890)

### Problem: Emails not sending

**Fix:**
1. Verify EMAIL_* variables in Vercel
2. If Gmail: Verify 2FA enabled and App Password generated
3. Check server logs: `vercel logs --follow`
4. Look for "Error sending email:" messages

### Problem: Airtable records not appearing

**Fix:**
1. Verify AIRTABLE_API_KEY is correct
2. Verify AIRTABLE_BASE_ID and AIRTABLE_*_TABLE_ID correct
3. Check Airtable logs in server logs: `vercel logs --follow`
4. Verify table columns named exactly right (case-sensitive)

---

## Production Checklist

```
DEPLOYMENT
☐ Code committed to main branch
☐ Vercel account created
☐ Project imported into Vercel
☐ All environment variables added (not just some)
☐ Build successful (no errors)

TESTING
☐ Health check returns 200 OK
☐ Submit test lead - returns success
☐ Database record created in production
☐ Email sent to owner
☐ Airtable record created (if configured)

TWILIO CONFIGURATION
☐ Webhook URLs updated to production URL
☐ All three webhooks pointing to vercel.app:
  ☐ Incoming call
  ☐ Call status changes
  ☐ SMS inbound

PRODUCTION TEST
☐ Call your Twilio number from phone
☐ Hear voicemail greeting
☐ Database shows MissedCall record
☐ Email received within 10 seconds
☐ Airtable shows record (if configured)

MONITORING
☐ Vercel logs accessible
☐ No 5xx errors in logs
☐ Response times normal (< 1s)
☐ Email alerts configured (optional)
```

---

## Scaling Your Deployment

### For Multiple Clients

Each client gets their own `businessId`:

```bash
# Business 1
curl -X POST https://your-app.vercel.app/api/webhooks/lead-submission \
  -d '{"name":"Client1 Lead","phone":"+15551111111","businessId":1}'

# Business 2
curl -X POST https://your-app.vercel.app/api/webhooks/lead-submission \
  -d '{"name":"Client2 Lead","phone":"+15552222222","businessId":2}'
```

Each business uses their own:
- Twilio number (if desired)
- Email recipient
- Message templates
- Airtable base (if desired)

Configuration is in `BusinessConfig` table.

### Vercel Plan Recommendations

| Deployment Size | Vercel Plan | Why |
|---|---|---|
| Testing / Demo | Free | Perfect for 1-5 customers, <100 calls/month |
| Small Business | Pro ($20/month) | 5-20 customers, <1000 calls/month |
| Growing | Pro or Business | 20+ customers, frequent deployments, priority support |
| Enterprise | Business | 100+ customers, custom domain, SLA, dedicated support |

**All plans include:** Unlimited serverless functions, 50GB bandwidth/month, 24/7 monitoring

---

## Next Steps

1. ✅ Deploy to Vercel (this guide)
2. Configure your Twilio webhooks to point to production
3. Perform end-to-end production test
4. Add more businesses to BusinessConfig table
5. Monitor production logs and performance

---

## Quick Reference

### Deploy with CLI
```bash
vercel login
vercel deploy --prod
```

### View Logs
```bash
vercel logs --follow
```

### Add Environment Variable
```
Vercel Dashboard → Your Project → Settings → Environment Variables
→ Add New → Name + Value → Save
```

### Rollback Deployment
```bash
vercel deploy --prod --name old-build
# Or in dashboard: Deployments → Click old version → Promote
```

---

**Status: Vercel Deployment Complete ✅**

Your system is now live and ready to receive real Twilio webhooks. Monitor logs and test with real calls to verify everything works.

