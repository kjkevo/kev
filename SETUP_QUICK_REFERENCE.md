# Quick Reference Setup Checklist

Use this as a checklist while setting everything up. Check off each item as you complete it.

---

## 🎯 Phase 1: Email & SMS (15 minutes)

### Resend Email
- [ ] Go to https://resend.com
- [ ] Sign up & verify email
- [ ] Get API Key: `Settings → API Keys → Create`
- [ ] Copy key (starts with `re_`)
- [ ] Add to `.env.local`:
  ```
  RESEND_API_KEY=re_xxx
  RESEND_FROM_EMAIL=onboarding@resend.dev
  ```
- [ ] Test: `curl -X POST https://api.resend.com/emails ...`

### Twilio SMS (Optional)
- [ ] Go to https://www.twilio.com
- [ ] Sign up & verify phone
- [ ] Get: Account SID, Auth Token, Phone Number
- [ ] Add to `.env.local`:
  ```
  TWILIO_ACCOUNT_SID=AC...
  TWILIO_AUTH_TOKEN=...
  TWILIO_PHONE_NUMBER=+1...
  ```

---

## 🎯 Phase 2: Review Links (20 minutes)

### Google Business
- [ ] Go to https://www.google.com/maps
- [ ] Search your business
- [ ] If not found: https://www.google.com/business → Create
- [ ] Copy review URL: `https://g.page/your-name`

### Yelp Business
- [ ] Go to https://www.yelp.com
- [ ] Search your business
- [ ] If not found: https://biz.yelp.com → Add Business
- [ ] Copy review URL: `https://yelp.com/biz/your-name`

### Store URLs (for later)
```
Google: https://g.page/your-business
Yelp:   https://yelp.com/biz/your-business
```

---

## 🎯 Phase 3: Analytics - Airtable (10 minutes)

### Create Airtable Base
- [ ] Go to https://airtable.com
- [ ] Sign up
- [ ] Create base: "Review Automation"
- [ ] Create table: "Reviews"

### Create Columns
Add these column headers:
- [ ] Request ID (Number)
- [ ] Customer Name (Text)
- [ ] Customer Email (Email)
- [ ] Customer Phone (Phone)
- [ ] Job Completed (Date)
- [ ] Rating (Number)
- [ ] Feedback (Long Text)
- [ ] Feedback Type (Single Select: "Public Review", "Private Feedback")
- [ ] Redirect URL (URL)
- [ ] Responded At (Date)
- [ ] Created At (Date)

### Get Credentials
- [ ] Account → Developer → Generate API Key
- [ ] Copy API Key: `key_xxx`
- [ ] Copy Base ID from URL: `appXXXX`
- [ ] Add to `.env.local`:
  ```
  AIRTABLE_API_KEY=key_xxx
  AIRTABLE_BASE_ID=appXXXX
  ```

---

## 🎯 Phase 4: Database (15 minutes)

### Create PostgreSQL Database

**Option A: Supabase (Recommended)**
- [ ] Go to https://supabase.com
- [ ] Sign up with GitHub
- [ ] Create project
- [ ] Copy DATABASE_URL
- [ ] Copy DIRECT_URL
- [ ] Add to `.env.local`:
  ```
  DATABASE_URL=postgresql://...?pgbouncer=true
  DIRECT_URL=postgresql://...
  ```

**Option B: Railway**
- [ ] Go to https://railway.app
- [ ] Create project
- [ ] Add PostgreSQL
- [ ] Copy connection strings

### Run Migrations
- [ ] Run: `npm run db:migrate`
- [ ] Verify: Check database for 3 tables
  ```
  ReviewClient
  ReviewRequest
  ReviewResponse
  ```

---

## 🎯 Phase 5: Hosting (20 minutes)

### Push to GitHub
- [ ] Create GitHub repo
- [ ] Push code:
  ```bash
  git remote add origin https://github.com/YOUR/repo
  git push -u origin main
  ```

### Deploy to Vercel
- [ ] Go to https://vercel.com
- [ ] Sign in with GitHub
- [ ] Import your repo
- [ ] Add environment variables:
  - [ ] DATABASE_URL
  - [ ] DIRECT_URL
  - [ ] RESEND_API_KEY
  - [ ] RESEND_FROM_EMAIL
  - [ ] TWILIO_* (if using SMS)
  - [ ] ADMIN_API_KEY
  - [ ] REVIEW_JOB_API_KEY
  - [ ] NEXTAUTH_SECRET
  - [ ] NEXTAUTH_URL (your Vercel URL)
- [ ] Click Deploy
- [ ] Copy your URL: `https://your-project.vercel.app`
- [ ] Verify it works: Visit URL in browser

### Enable Crons
- [ ] Go to Project Settings
- [ ] Enable "Cron Jobs"
- [ ] Already configured in vercel.json ✅

---

## 🎯 Phase 6: Create First Client (5 minutes)

### Gather Information
```
Business Name:       ABC Plumbing
Owner Email:         owner@abcplumbing.com
Owner Name:          John Smith
Google Review URL:   https://g.page/abc-plumbing
Yelp Review URL:     https://yelp.com/biz/abc-plumbing
Delay Hours:         3
```

### Create Client via API
```bash
curl -X POST https://your-app.vercel.app/api/admin/clients \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC Plumbing",
    "businessEmail": "owner@abcplumbing.com",
    "contactName": "John Smith",
    "delayHours": 3,
    "messageTemplate": "Hi {customerName}, rate {businessName}: {link}",
    "googleReviewUrl": "https://g.page/abc-plumbing",
    "yelpReviewUrl": "https://yelp.com/biz/abc-plumbing",
    "airtableBaseId": "appXXXX",
    "airtableApiKey": "key_xxx"
  }'
```

- [ ] Save the response (contains webhook secret!)

---

## 🎯 Phase 7: Test End-to-End (10 minutes)

### Send Webhook
```bash
curl -X POST https://your-app.vercel.app/api/webhook/job-completed \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "ABC Plumbing",
    "customerName": "Jane Doe",
    "customerEmail": "jane@example.com",
    "jobCompletedAt": "2024-07-05T14:00:00Z",
    "webhookSecret": "PASTE_SECRET_HERE"
  }'
```
- [ ] Response: 201 with requestId

### Open Rating Form
```
https://your-app.vercel.app/rate/1
```
- [ ] Page loads
- [ ] Shows "Rating for ABC Plumbing"
- [ ] Shows 5 stars

### Submit 5-Star Rating
- [ ] Click 5th star
- [ ] Click Submit
- [ ] Redirects to Google review link

### Check Logs
- [ ] Check database: ReviewResponse created
- [ ] Check Airtable: Record logged automatically
- [ ] Check email: Business owner received any notifications (if 1-3 stars)

---

## 📊 Final Verification

**Everything is working when:**

✅ All services set up (Resend, Airtable, Supabase, Vercel)
✅ Can create a client via API (get webhook secret)
✅ Can send webhook to /api/webhook/job-completed
✅ Can open rating form at /rate/[requestId]
✅ Can submit rating (5 stars = redirect, 2 stars = private email)
✅ Responses logged in database AND Airtable
✅ Email sent for negative ratings

---

## Environment Variables Summary

Copy this template and fill in your values:

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/db?pgbouncer=true
DIRECT_URL=postgresql://user:password@host:port/db

# Email (Resend)
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=onboarding@resend.dev

# SMS (Twilio) - Optional
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1234567890

# Analytics (Airtable) - Optional
AIRTABLE_API_KEY=key_xxx
AIRTABLE_BASE_ID=appXXXX

# Auth & Security
NEXTAUTH_SECRET=generate-random-key
NEXTAUTH_URL=https://your-app.vercel.app
ADMIN_API_KEY=your-secret-admin-key
REVIEW_JOB_API_KEY=your-secret-job-key
```

---

## Support Links

- **Resend Docs**: https://resend.com/docs
- **Twilio Docs**: https://www.twilio.com/docs
- **Airtable API**: https://airtable.com/api
- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **Next.js Docs**: https://nextjs.org/docs

---

**Estimated Total Time: ~90 minutes**

Once complete, you're ready to:
1. Accept webhooks from your service platform
2. Send review requests to customers
3. Collect ratings and feedback
4. Route to Google/Yelp or private email
5. Log everything to Airtable
6. Monitor analytics

**Let's go! 🚀**
