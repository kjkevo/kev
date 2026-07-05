# Complete Infrastructure Setup Guide

Follow this to set up all the services needed for the Review Reputation system to work end-to-end.

---

## Part 1: Email Service Setup (Resend)

### Why Resend?
- Free tier: 100 emails/month
- Simple API
- No credit card needed for testing
- Production-ready reliability
- Perfect for transactional emails

### Step 1a: Create Resend Account

1. Go to: https://resend.com
2. Click **"Get Started"** (top right)
3. Sign up with email or GitHub
4. Verify your email

### Step 1b: Get API Key

1. Dashboard → **API Keys** (left sidebar)
2. Click **"Create API Key"**
3. Name it: "Review Automation"
4. Copy the key that starts with `re_`

**Your API Key**: `re_abc123...`

### Step 1c: Verify Sending Email

1. Dashboard → **Domains** (left sidebar)
2. You'll see **Default Domain**: `onboarding@resend.dev`
3. This is your sender for testing

**For Production** (skip for now):
- Add your own domain (yoursite.com)
- Verify DNS records
- Use `noreply@yoursite.com` as sender

### Step 1d: Add to Environment

In `.env.local`:
```env
RESEND_API_KEY=re_abc123...
RESEND_FROM_EMAIL=onboarding@resend.dev
```

### Step 1e: Test Email Sending

```bash
curl https://api.resend.com/emails \
  -X POST \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer re_abc123..." \
  -d '{
    "from": "onboarding@resend.dev",
    "to": "your-email@gmail.com",
    "subject": "Test Email",
    "html": "<p>Hello World</p>"
  }'
```

**Expected Response**:
```json
{
  "id": "abc123",
  "from": "onboarding@resend.dev",
  "to": "your-email@gmail.com",
  "created_at": "2024-07-05T14:30:00.000Z"
}
```

✅ **Email service working**

---

## Part 2: SMS Service Setup (Twilio) - Optional

### Why Twilio?
- Sends SMS as fallback if email unavailable
- Trial credits: $15
- Pay-as-you-go: $0.0075 per SMS
- Reliable delivery
- Optional but recommended

### Step 2a: Create Twilio Account

1. Go to: https://www.twilio.com
2. Click **"Sign up"** (top right)
3. Enter phone number
4. Verify with code sent to phone
5. Create account

### Step 2b: Get Credentials

1. Dashboard → **Account** (left sidebar)
2. Copy these three items:
   - **Account SID**: `ACxxxx...`
   - **Auth Token**: `xxx...`
   - **Phone Number**: Already assigned (e.g., +1234567890)

### Step 2c: Add to Environment

In `.env.local`:
```env
TWILIO_ACCOUNT_SID=ACxxxx...
TWILIO_AUTH_TOKEN=xxx...
TWILIO_PHONE_NUMBER=+1234567890
```

### Step 2d: Test SMS (Optional)

```bash
# Using Node.js
npm install twilio

# Create test.js:
const twilio = require('twilio');
const client = twilio('ACxxxx...', 'xxx...');

client.messages.create({
  body: 'Hello from Twilio!',
  from: '+1234567890',
  to: '+1YOUR_PHONE_NUMBER'
}).then(message => console.log('Sent!'));
```

**Expected**: Text message arrives on your phone ✅

---

## Part 3: Get Google Business & Yelp Links

### For Your Test Business

#### Getting Google Review Link

1. Go to: https://www.google.com/maps
2. Search for your business name
3. If found, click **"Write a review"** button
4. Copy the URL from browser:
   ```
   https://g.page/your-business-name
   ```

**If business not on Google Maps**:
1. Go to: https://www.google.com/business
2. Click **"Manage Now"**
3. Search for your business
4. If not listed, click **"Create a business"**
5. Fill in name, address, phone
6. Wait for verification (phone/postcard)
7. Once verified, copy the review link

#### Getting Yelp Review Link

1. Go to: https://www.yelp.com
2. Search for your business name
3. If found, look for **"Write a Review"** button
4. Copy the URL from browser:
   ```
   https://www.yelp.com/biz/your-business-name
   ```

**If business not on Yelp**:
1. Go to: https://biz.yelp.com
2. Click **"Claim Your Business"**
3. Search for your business
4. If not found, click **"Add a Business"**
5. Fill in information
6. Verify and activate
7. Copy the review URL

### Store These Links

**In your client configuration** (we'll add them in Part 7):
```
googleReviewUrl: https://g.page/your-business-name
yelpReviewUrl: https://www.yelp.com/biz/your-business-name
```

---

## Part 4: Airtable Setup (For Logging)

### Why Airtable?
- Free tier: 1,200 records
- Visual database
- Easy integration
- Real-time updates
- Perfect for viewing review feedback

### Step 4a: Create Airtable Account

1. Go to: https://airtable.com
2. Click **"Sign up"**
3. Create account with email
4. Verify email

### Step 4b: Create a New Base (Database)

1. Homepage → Click **"+ Add a base"**
2. Name it: "Review Automation"
3. Click **"Create base"**

### Step 4c: Create Table & Columns

1. Table name: **"Reviews"**
2. Click on table to edit
3. Add these columns:
   - **Request ID** (Number)
   - **Customer Name** (Text)
   - **Customer Email** (Email)
   - **Customer Phone** (Phone)
   - **Job Completed** (Date)
   - **Rating** (Number, 1-5)
   - **Feedback** (Long Text)
   - **Feedback Type** (Single Select: "Public Review", "Private Feedback")
   - **Redirect URL** (URL)
   - **Responded At** (Date)
   - **Created At** (Date)

### Step 4d: Get API Key & Base ID

1. Top right → **Account** (icon)
2. Click **"Developer"** (left sidebar)
3. Click **"Generate"** token
4. Name: "Review Automation"
5. Copy the token (starts with `key_`)

**Your API Key**: `key_abc123...`

**Get Base ID**:
1. Go back to your base
2. URL is: `https://airtable.com/`**`appXXXXX`**`/...`
3. Copy the part after `/` (appXXXXX)

**Your Base ID**: `appXXXXX...`

### Step 4e: Add to Environment (Optional)

In `.env.local`:
```env
AIRTABLE_API_KEY=key_abc123...
AIRTABLE_BASE_ID=appXXXXX...
```

### Step 4f: Test Airtable Connection

```bash
# Using curl
curl https://api.airtable.com/v0/appXXXXX/Reviews \
  -H "Authorization: Bearer key_abc123..."

# Should return: {"records": [], "offset": null}
```

✅ **Airtable connected**

---

## Part 5: Google Sheets Alternative (Instead of Airtable)

### Step 5a: Create Google Sheet

1. Go to: https://sheets.google.com
2. Click **"+ Create New Spreadsheet"**
3. Name: "Review Automation"
4. Click **"Create"**

### Step 5b: Set Up Columns

Create these column headers in Row 1:
```
A: Request ID
B: Customer Name
C: Customer Email
D: Customer Phone
E: Job Completed
F: Rating
G: Feedback
H: Feedback Type
I: Redirect URL
J: Responded At
K: Created At
```

### Step 5c: Share & Get API Access

1. Click **"Share"** (top right)
2. Change to **"Anyone with link can view"**
3. Click **"Share"**

**To automate writes**, use Google Apps Script:
1. **Tools** → **Script Editor**
2. Paste this code:

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSheet();
  const data = JSON.parse(e.postData.contents);
  
  sheet.appendRow([
    data.requestId,
    data.customerName,
    data.customerEmail,
    data.customerPhone,
    data.jobCompleted,
    data.rating,
    data.feedback,
    data.feedbackType,
    data.redirectUrl,
    data.respondedAt,
    data.createdAt
  ]);
  
  return ContentService
    .createTextOutput(JSON.stringify({success: true}))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Click **"Deploy"** → **"New Deployment"**
4. Type: **"Web app"**
5. Execute as: Your email
6. Allow access: Anyone
7. Copy the deployment URL

**Use the URL to send data** (optional):
```bash
curl -X POST "DEPLOYMENT_URL" \
  -d '{
    "requestId": 1,
    "customerName": "Jane",
    "rating": 5,
    "feedbackType": "Public Review"
  }'
```

---

## Part 6: Hosting Setup

### Option A: Vercel (Recommended - Free)

#### Why Vercel?
- Free tier
- Auto-deploys from GitHub
- Built-in cron jobs
- Fast performance
- Perfect for Next.js

#### Step 6a: Push to GitHub

```bash
# 1. Create GitHub repo
git remote add origin https://github.com/YOUR_USERNAME/review-automation.git
git push -u origin main

# 2. Go to: https://vercel.com
# 3. Click "Sign up" → Select "GitHub"
# 4. Authorize Vercel access to your repos
```

#### Step 6b: Import Project

1. Vercel Dashboard → **"Add New..."** → **"Project"**
2. Find your `review-automation` repo
3. Click **"Import"**

#### Step 6c: Set Environment Variables

1. **Environment Variables** section
2. Add each variable from `.env.local`:
   - DATABASE_URL
   - DIRECT_URL
   - RESEND_API_KEY
   - TWILIO_ACCOUNT_SID
   - TWILIO_AUTH_TOKEN
   - TWILIO_PHONE_NUMBER
   - ADMIN_API_KEY
   - REVIEW_JOB_API_KEY
   - NEXTAUTH_SECRET
   - NEXTAUTH_URL (set to your Vercel URL)

3. Click **"Deploy"**

#### Step 6d: Get Your URL

After deployment:
```
https://your-project-name.vercel.app
```

Update `NEXTAUTH_URL` to this value.

#### Step 6e: Enable Cron Jobs

1. Project Settings → **"Crons"**
2. Enable Cron Jobs
3. Already configured in `vercel.json` to run every 5 minutes ✅

### Option B: Railway.app (Alternative)

#### Step 6b: Create Railway Account

1. Go to: https://railway.app
2. Sign up with GitHub
3. Create new project

#### Step 6c: Add PostgreSQL Database

1. Dashboard → **"Create"** → **"Database"**
2. Select **"PostgreSQL"**
3. Wait for provisioning

#### Step 6d: Deploy App

1. **"Create"** → **"GitHub Repo"**
2. Select your repo
3. Add environment variables same as Vercel

#### Step 6e: Get URL

Your app URL will be shown in Railway dashboard

---

## Part 7: Database Setup

### Step 7a: Create PostgreSQL Database

**Option 1: Supabase (Recommended - Free)**
1. Go to: https://supabase.com
2. Sign up with GitHub
3. Create new project
4. Wait for provisioning
5. Go to **Settings** → **Database** → **Connection String**
6. Copy connection string with password

**Option 2: Railway**
Already set up in Part 6

**Option 3: Vercel Postgres (New)**
1. Vercel Dashboard → **"Storage"**
2. Create **"Postgres"**
3. Copy connection string

### Step 7b: Set Connection Strings

In `.env.local`:
```env
DATABASE_URL=postgresql://user:password@host:port/dbname?pgbouncer=true
DIRECT_URL=postgresql://user:password@host:port/dbname
```

### Step 7c: Run Migrations

```bash
npm run db:migrate
```

Expected output:
```
✓ Database connected
✓ 3 migrations applied
✓ ReviewClient table created
✓ ReviewRequest table created
✓ ReviewResponse table created
```

✅ **Database ready**

---

## Part 8: Complete Configuration for a Client

Now that all services are set up, create your first real client:

### Step 8a: Collect Your Information

```
Business Name: ABC Plumbing
Owner Email: owner@abcplumbing.com
Google Review URL: https://g.page/abc-plumbing
Yelp Review URL: https://yelp.com/biz/abc-plumbing
Delay Hours: 3
Message Template: "Hi {customerName}, thank you for choosing {businessName}! 
                   We'd love your feedback: {link}"
```

### Step 8b: Create Client via API

```bash
curl -X POST https://your-app.vercel.app/api/admin/clients \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC Plumbing",
    "businessEmail": "owner@abcplumbing.com",
    "contactName": "John Smith",
    "delayHours": 3,
    "messageTemplate": "Hi {customerName}, thank you for choosing {businessName}! We'\''d love your feedback: {link}",
    "googleReviewUrl": "https://g.page/abc-plumbing",
    "yelpReviewUrl": "https://yelp.com/biz/abc-plumbing",
    "airtableBaseId": "appXXXXX...",
    "airtableApiKey": "key_xxx..."
  }'
```

**Response**:
```json
{
  "id": 1,
  "name": "ABC Plumbing",
  "webhookSecret": "webhook123...",
  "message": "Client created successfully. Keep the webhook secret secure."
}
```

✅ **Client configured and ready to receive webhooks**

---

## Part 9: Complete Setup Checklist

```
✅ Email Service (Resend)
  □ Account created
  □ API key copied (re_xxx)
  □ From email set (onboarding@resend.dev)
  □ Added to .env.local
  □ Test email sent successfully

✅ SMS Service (Twilio) - Optional
  □ Account created
  □ Account SID copied
  □ Auth Token copied
  □ Phone number assigned
  □ Added to .env.local

✅ Review Links
  □ Google Business listing found
  □ Google review URL copied (https://g.page/...)
  □ Yelp business profile found
  □ Yelp review URL copied (https://yelp.com/biz/...)

✅ Airtable Setup
  □ Account created
  □ Base "Review Automation" created
  □ Table "Reviews" with all columns created
  □ API key generated
  □ Base ID copied
  □ Added to .env.local

✅ Database Setup
  □ PostgreSQL provisioned (Supabase/Railway/Vercel)
  □ Connection strings set (DATABASE_URL, DIRECT_URL)
  □ Migrations run (npm run db:migrate)
  □ Tables verified in database

✅ Hosting Setup
  □ GitHub repo created and pushed
  □ Vercel project imported (or Railway project created)
  □ Environment variables set on hosting platform
  □ Deployed successfully
  □ App accessible at https://your-app.vercel.app

✅ First Client Created
  □ Business name, email, review links collected
  □ Client created via admin API
  □ Webhook secret saved
  □ Airtable logging configured
  □ Ready to receive job completion webhooks

✅ Verification
  □ Can send webhook to /api/webhook/job-completed
  □ Can open /rate/[requestId] rating form
  □ Can submit rating
  □ Email sends to business owner
  □ Response logged in Airtable/database
```

---

## Part 10: Connecting to Your Service Platform

Now that everything is set up, connect your service app (ServiceTitan, Jobber, Zapier, etc.) to send webhooks:

### Setup Webhook Integration

**Webhook URL**: `https://your-app.vercel.app/api/webhook/job-completed`

**Webhook Secret**: From client creation (save it safely)

**Required Fields in Webhook**:
```json
{
  "businessName": "ABC Plumbing",
  "customerName": "Jane Doe",
  "customerEmail": "jane@example.com",
  "customerPhone": "+15551234567",
  "jobCompletedAt": "2024-07-05T14:30:00Z",
  "webhookSecret": "webhook123..."
}
```

See **`INTEGRATION_EXAMPLES.md`** for platform-specific instructions (ServiceTitan, Jobber, Zapier, etc.)

---

## Troubleshooting Setup

### Email Not Sending

**Problem**: No email received  
**Solutions**:
1. Check RESEND_API_KEY is correct
2. Check RESEND_FROM_EMAIL is verified in Resend dashboard
3. Check email didn't go to spam
4. Check Resend dashboard for bounce reasons

### Database Connection Failing

**Problem**: `DATABASE_URL` error  
**Solutions**:
1. Verify DATABASE_URL format: `postgresql://user:password@host:port/db?pgbouncer=true`
2. Test connection: `psql $DATABASE_URL`
3. Check password has special characters properly URL-encoded
4. Verify database exists and is accessible

### Vercel Deployment Failed

**Problem**: Build fails on Vercel  
**Solutions**:
1. Check all environment variables are set
2. Run `npm run build` locally to test
3. Check git commit is pushed
4. Check for TypeScript errors: `npm run tsc`

### Airtable Not Logging

**Problem**: Reviews not appearing in Airtable  
**Solutions**:
1. Check AIRTABLE_API_KEY is correct
2. Check AIRTABLE_BASE_ID matches your base
3. Check "Reviews" table exists
4. Check table has all required columns
5. Verify API key permissions

### SMS Not Sending

**Problem**: SMS failed to send  
**Solutions**:
1. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN
2. Check TWILIO_PHONE_NUMBER is correct
3. Check phone number format includes country code (+1, etc.)
4. Check Twilio trial credits haven't expired
5. Check receiving phone number is valid

---

## Next Steps

1. ✅ Complete all setup steps above
2. ✅ Run `npm run dev` locally to test
3. ✅ Follow **`HOW_TO_VERIFY_ITS_WORKING.md`** to test all features
4. ✅ Deploy to Vercel (or Railway)
5. ✅ Connect your service platform (ServiceTitan, Jobber, Zapier)
6. ✅ Run a test from end to end
7. ✅ Monitor first production webhooks in dashboard

---

## Summary of All Services

| Service | Purpose | Free Tier | Setup Time |
|---------|---------|-----------|-----------|
| **Resend** | Email sending | 100/month | 5 min |
| **Twilio** | SMS (optional) | $15 trial | 5 min |
| **Airtable** | Analytics dashboard | 1,200 records | 10 min |
| **Supabase** | PostgreSQL database | 500MB | 5 min |
| **Vercel** | Hosting + crons | Free | 10 min |
| **Google/Yelp** | Review links | Free | 10 min |

**Total Setup Time**: ~45 minutes

**Total Monthly Cost**: $0-20 (depending on email volume)

You're now ready to start collecting reviews! 🚀
