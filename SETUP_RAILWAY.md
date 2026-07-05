# Railway Deployment Setup Guide - Alternative to Vercel

This guide walks you through deploying your missed call text-back automation system to Railway, an alternative to Vercel.

**Alternative:** For Vercel deployment, see [SETUP_VERCEL.md](SETUP_VERCEL.md)

---

## ✅ Prerequisites

Before deploying, you should have:
- [ ] GitHub account with repository
- [ ] Railway account (free tier available at railway.app)
- [ ] All configuration completed:
  - [ ] Twilio credentials (SETUP_TWILIO.md)
  - [ ] Airtable or database setup (SETUP_AIRTABLE.md)
  - [ ] Email configured (SETUP_EMAIL.md)
- [ ] Code committed to GitHub

---

## Step 1: When to Use Railway Instead of Vercel

### Use Vercel if:
- ✅ Simple serverless deployment
- ✅ Tightly integrated with Next.js
- ✅ Free tier sufficient for your needs
- ✅ Want easiest setup

### Use Railway if:
- ✅ Need more control over environment
- ✅ Want simpler costs (pay-per-use)
- ✅ Prefer different git integration
- ✅ Want to manage databases directly
- ✅ Need faster deployment feedback

**Recommendation:** Start with Vercel, switch to Railway if you need more flexibility.

---

## Step 2: Create Railway Account

1. Go to [Railway.app](https://railway.app)
2. Click **Start Project**
3. Sign in with **GitHub**
4. Authorize Railway to access your GitHub
5. You'll be redirected to Railway dashboard

---

## Step 3: Create New Project

### Option A: Deploy from GitHub (Recommended)

1. Click **New Project**
2. Select **Deploy from GitHub repo**
3. Select your repository (`kjkevo/kev`)
4. Click **Deploy**

### Option B: Create Blank Project

1. Click **New Project**
2. Select **Blank Project**
3. Click **Add Service** → **GitHub**
4. Select your repository

---

## Step 4: Configure Environment Variables

### Step 4A: Access Environment Variables

1. In Railway dashboard
2. Click your project
3. Click **Variables** tab (on right side)

### Step 4B: Add All Required Variables

You can add variables one at a time or in bulk. **Bulk is faster:**

1. Click **RAW Editor**
2. Paste all variables at once:

```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
AIRTABLE_API_KEY=pat...
AIRTABLE_BASE_ID=app...
AIRTABLE_MISSED_CALLS_TABLE_ID=tbl...
AIRTABLE_LEADS_TABLE_ID=tbl...
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop
EMAIL_FROM_NAME=Your Business Name
BUSINESS_NAME=Your Business
BUSINESS_OWNER_PHONE=+1...
BUSINESS_OWNER_EMAIL=owner@yourbiz.com
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
WEBHOOK_URL=https://your-railway-app.up.railway.app
```

3. Click **Save**

### Step 4C: Verify Variables

Click **Reference** tab to see all variables loaded.

---

## Step 5: Link Your Database (if using external database)

### If Using Supabase:

1. In Railway dashboard, click **Add Service**
2. Select **PostgreSQL**
3. This creates a new database in Railway

**OR** connect your existing Supabase:

1. Get Supabase connection string: https://app.supabase.com → Project → Settings → Database
2. In Railway, add variable:
   ```
   DATABASE_URL=postgresql://postgres:[password]@[host]:5432/[database]
   ```

---

## Step 6: Deploy

### Railway Auto-Deploys on Git Push

Once configured, Railway automatically deploys when you push to GitHub.

**Trigger deployment:**

```bash
git add .
git commit -m "Deploy to Railway"
git push origin main
```

**Or manually deploy:**

1. In Railway dashboard
2. Click your project
3. Click **Deploy** → **Deploy Latest**

**Watch deployment progress:**

In Railway dashboard, you'll see:
```
Building...
✓ Build successful
✓ Deployment running
✓ Health checks passing
```

---

## Step 7: Get Your Deployment URL

### Find Your Public URL

1. In Railway dashboard, click your project
2. Click **Deployments** tab
3. Click the green deployment
4. Scroll to **Railway Domain**
5. Copy the URL: `https://your-railway-app.up.railway.app`

---

## Step 8: Test Production Deployment

### Test 1: Health Check

```bash
curl https://your-railway-app.up.railway.app/api/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

### Test 2: Submit Test Lead

```bash
curl -X POST https://your-railway-app.up.railway.app/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Test",
    "phone": "+15551234567",
    "serviceRequested": "Test Service",
    "businessId": 1
  }'
```

### Test 3: Verify Email Sent

Check business owner inbox within 10 seconds.

### Test 4: Verify Database Record

```bash
npm run db:studio
# Check LeadSubmission table for new record
```

---

## Step 9: Update Twilio Webhooks

1. Go to [Twilio Console](https://console.twilio.com/)
2. Phone Numbers → Manage Numbers → Your Number
3. Update webhook URLs:

**Replace:**
```
http://localhost:3000
```

**With:**
```
https://your-railway-app.up.railway.app
```

**Final URLs:**
- Incoming Call: `https://your-railway-app.up.railway.app/api/webhooks/twilio/incoming-call`
- Call Status: `https://your-railway-app.up.railway.app/api/webhooks/twilio/call-status`
- SMS Inbound: `https://your-railway-app.up.railway.app/api/webhooks/twilio/sms-inbound`

4. Click **Save**

---

## Step 10: Run Full Production Test

### Call Your Twilio Number

1. Call from any phone
2. Hear voicemail
3. Hang up

### Verify Results

**Database:**
```bash
npm run db:studio
# MissedCall table has new record
```

**Airtable:**
```
Verify missed call recorded
```

**Email:**
```
Check inbox for alert
```

---

## Monitoring Railway Deployment

### View Logs

1. In Railway dashboard
2. Click your project
3. Click **Deployments** → Click deployment
4. Click **Logs** tab

**Real-time logs:**
```
2024-01-15 10:30:42.123 ▲ Next.js 14.2.3
2024-01-15 10:30:43.456 ✓ Ready in 1234ms
2024-01-15 10:30:50.789 GET /api/health 200
2024-01-15 10:30:51.012 POST /api/webhooks/twilio/call-status 200
```

### Check Status

1. Click **Health** tab
2. See CPU, memory, disk usage
3. Response times and error rates

---

## Troubleshooting Railway Deployment

### Problem: Deployment fails with "Cannot find module"

**Fix:**
1. Ensure all dependencies in package.json
2. Run locally: `npm install`
3. Commit package-lock.json: `git add package-lock.json && git commit -m "Update deps" && git push`
4. Railway will retry

### Problem: Environment variables not loading

**Fix:**
1. In Railway, click **Variables** tab
2. Verify all variables present
3. Click **Redeploy** to apply variables to current deployment

### Problem: Database connection fails

**Fix:**
1. Verify DATABASE_URL is set
2. If using Railway PostgreSQL:
   - Click **Add Service** → **PostgreSQL**
   - Railway auto-injects DATABASE_URL
3. If using Supabase:
   - Verify connection string format: `postgresql://user:pass@host:5432/db`
   - Check Supabase allows connections from Railway IPs

### Problem: API returns 500 error

**Fix:**
1. Check logs: **Deployments** → **Logs**
2. Look for error messages
3. Verify environment variables set
4. Check database connection

### Problem: SMS not sending

**Fix:**
1. Check Twilio logs: [Console → Logs → Messages](https://console.twilio.com/us/account/logs/messages)
2. Verify TWILIO_* variables in Railway
3. Check railway logs for SMS errors

---

## Railway vs Vercel Comparison

| Feature | Railway | Vercel |
|---------|---------|--------|
| **Setup time** | 10 min | 5 min |
| **Cost** | $5/month + usage | Free tier, then $20/month |
| **Scaling** | Automatic | Automatic |
| **Database** | Built-in PostgreSQL | Must connect external |
| **Logs** | Web UI + CLI | Web UI + CLI |
| **Deployments** | Auto on git push | Auto on git push |
| **Support** | Community | Community + paid tiers |
| **Learning curve** | Medium | Easy |

**Recommendation:**
- **Start with Vercel:** Easier to get going, no database management
- **Switch to Railway:** If you need more control or prefer its interface

---

## Advanced: Multiple Environments

Railway supports staging and production:

### Create Staging Environment

1. In Railway, click **New Environment**
2. Name it "Staging"
3. This creates separate deployment
4. Set different variables for staging
5. Deploy to staging first, then promote to production

**Benefits:**
- Test before going live
- Different databases per environment
- Roll back easily

---

## Production Checklist

```
DEPLOYMENT
☐ GitHub repository connected to Railway
☐ Environment variables added
☐ Database connected (if external)
☐ Build successful

TESTING
☐ Health check returns 200 OK
☐ Submit test lead - success
☐ Database record created
☐ Email sent
☐ Airtable record created

TWILIO CONFIGURATION
☐ Webhook URLs updated to Railway URL
☐ All three webhooks configured correctly

MONITORING
☐ Can view logs in Railway
☐ No errors in deployment logs
☐ Response times normal
```

---

## Quick Reference

### Deploy
```bash
git push origin main
# Railway auto-deploys
```

### Check Logs
```
Railway Dashboard → Deployments → Logs
```

### Add Variable
```
Railway Dashboard → Variables → Add
Name: VARIABLE_NAME
Value: variable_value
```

### Get Deployment URL
```
Railway Dashboard → Deployments → Click deployment
→ Look for Railway Domain
```

### Redeploy
```
Railway Dashboard → Deployments → Redeploy
```

---

## Next Steps

1. ✅ Deploy to Railway (this guide)
2. Test with production Twilio webhooks
3. Monitor logs and performance
4. Add more businesses to BusinessConfig table
5. Consider switching to Vercel if preferred

---

## Getting Help

- **Railway Docs:** https://docs.railway.app
- **Next.js on Railway:** https://docs.railway.app/guides/nextjs
- **Discord Community:** https://railway.app/community

---

**Status: Railway Deployment Complete ✅**

Your system is now deployed and ready for production. Test with real Twilio calls to verify everything works correctly.

