# How to Know It's All Working - Complete Verification Guide

This guide gives you **concrete proof** that every feature is working.

---

## Part 1: Setup & Prerequisites

### Check Your Environment

```bash
# 1. Verify Node/npm
node --version  # Should be 16+
npm --version

# 2. Verify environment variables are set
cat .env.local | grep -E "DATABASE_URL|ADMIN_API_KEY|REVIEW_JOB_API_KEY"

# Should output:
# DATABASE_URL=...
# ADMIN_API_KEY=...
# REVIEW_JOB_API_KEY=...
```

### Install & Start Dev Server

```bash
# 1. Install dependencies
npm install

# 2. Run database migrations
npm run db:migrate

# 3. Start dev server
npm run dev

# Output should show:
# ➜ Local:   http://localhost:3000
# ➜ Modules: 1 client, 2 utils
# ➜ Ready in 1234ms
```

---

## Part 2: Visual Verification (Browser)

### Open the App

```
http://localhost:3000
```

**You should see**: Next.js app running (whatever dashboard/page you have)

**If you see errors**: Check console for TypeScript or import errors

---

## Part 3: Database Verification

### Connect to Your Database

**Using psql** (PostgreSQL client):
```bash
psql postgresql://user:password@localhost:5432/dbname
```

**Using Supabase dashboard**:
```
https://app.supabase.com → Select project → SQL Editor
```

### Verify Tables Exist

Run this query:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema='public' 
AND table_name IN ('ReviewClient', 'ReviewRequest', 'ReviewResponse');
```

**Expected Output**:
```
table_name
------------------------
ReviewClient
ReviewRequest
ReviewResponse
```

✅ If you see all 3 tables → **Database schema is correct**

### Verify Tables Are Empty

```sql
SELECT COUNT(*) FROM "ReviewClient";
SELECT COUNT(*) FROM "ReviewRequest";
SELECT COUNT(*) FROM "ReviewResponse";
```

**Expected Output**:
```
count
-------
    0
    0
    0
```

✅ If all are 0 → **Tables are ready for testing**

---

## Part 4: Test 1 - Create a Client (Configuration)

### Run This Command

```bash
ADMIN_KEY="test-admin-secret-key"  # Use value from .env.local

curl -X POST http://localhost:3000/api/admin/clients \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Business",
    "businessEmail": "owner@test.com",
    "contactName": "Test Owner",
    "delayHours": 1,
    "messageTemplate": "Hi {customerName}, rate {businessName}: {link}",
    "googleReviewUrl": "https://g.page/test-business"
  }'
```

### What You Should See

**Success Response** (201 Created):
```json
{
  "id": 1,
  "name": "Test Business",
  "businessEmail": "owner@test.com",
  "contactName": "Test Owner",
  "delayHours": 1,
  "messageTemplate": "Hi {customerName}, rate {businessName}: {link}",
  "googleReviewUrl": "https://g.page/test-business",
  "webhookSecret": "abc123secret123...",
  "enabled": true,
  "message": "Client created successfully. Keep the webhook secret secure."
}
```

**✅ Signs It Worked**:
- ✅ Status code: 201
- ✅ Returns an `id` (should be 1)
- ✅ Returns `webhookSecret` (save this!)
- ✅ All fields match your input

**❌ If You See Error**:
- 401: `ADMIN_KEY` is wrong → Check `.env.local`
- 400: Missing required fields → Add all required fields
- 500: Database connection failed → Check `DATABASE_URL`

### Verify in Database

```sql
SELECT id, name, businessEmail, delayHours 
FROM "ReviewClient" 
WHERE id = 1;
```

**Expected**:
```
id | name           | businessEmail    | delayHours
----+----------------+------------------+----------
1  | Test Business  | owner@test.com   | 1
```

✅ **Client successfully created in database**

---

## Part 5: Test 2 - Send Webhook (Job Completion)

### Run This Command

Use the `webhookSecret` from the previous step:

```bash
WEBHOOK_SECRET="abc123secret123..."  # From client creation response

curl -X POST http://localhost:3000/api/webhook/job-completed \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Test Business",
    "customerName": "Jane Doe",
    "customerEmail": "jane@example.com",
    "customerPhone": "+15551234567",
    "jobCompletedAt": "2024-07-05T14:00:00Z",
    "webhookSecret": "'$WEBHOOK_SECRET'"
  }'
```

### What You Should See

**Success Response** (201 Created):
```json
{
  "success": true,
  "requestId": 1,
  "message": "Review request scheduled to be sent in 1 hours"
}
```

**✅ Signs It Worked**:
- ✅ Status code: 201
- ✅ `success: true`
- ✅ Returns `requestId` (should be 1)
- ✅ Message mentions delay time (1 hour)

**❌ If You See Error**:
- 404: Business not found → Check business name matches exactly
- 401: Invalid webhook secret → Use exact secret from creation
- 400: Missing required fields → All 5 fields required

### Verify in Database

```sql
SELECT id, customerName, customerEmail, jobCompletedAt, sendAfter 
FROM "ReviewRequest" 
WHERE id = 1;
```

**Expected**:
```
id | customerName | customerEmail     | jobCompletedAt      | sendAfter
----+--------------+-------------------+---------------------+---------------------
1  | Jane Doe     | jane@example.com  | 2024-07-05 14:00:00 | 2024-07-05 15:00:00
```

**Verify delay** (sendAfter should be 1 hour after jobCompletedAt):
- jobCompletedAt: 14:00
- sendAfter: 15:00
- Difference: 1 hour ✅

✅ **Webhook processed and delay calculated correctly**

---

## Part 6: Test 3 - Rating Form Page

### Open the Rating Form

```
http://localhost:3000/rate/1
```

### What You Should See

**Visual Elements**:
```
┌────────────────────────────────────┐
│                                    │
│   Rating for                       │
│   Test Business                    │  ← Business name displays
│                                    │
│   How was your service?            │
│   We'd love your feedback          │
│                                    │
│   ★  ★  ★  ★  ★                   │
│   (clickable stars)                │
│                                    │
│   Optional feedback textarea       │
│                                    │
│   [Submit Rating]                  │
└────────────────────────────────────┘
```

**✅ Signs It Worked**:
- ✅ Page loads without errors
- ✅ Shows business name "Test Business"
- ✅ Shows 5 clickable stars
- ✅ Stars turn gold when you click them
- ✅ Feedback textarea appears after selecting stars
- ✅ Submit button is disabled until you select a rating

**❌ If You See Errors**:
- "Loading...": Database still loading → Wait a moment
- "Review request not found": requestId doesn't exist → Check database
- Console error: Check browser console (F12) for details

### Click Stars to Test Interaction

1. Click on the **5th star** (highest rating)
2. Verify: Star turns **gold/yellow** ✅
3. Type some feedback: "This was great!" ✅
4. **DON'T submit yet** - we'll test that next

---

## Part 7: Test 4 - Submit 5-Star Rating (Positive Path)

### Submit Your Rating

With 5 stars selected, click **"Submit Rating"** button

### What You Should See

**Immediate**:
- Button shows "Submitting..." ✅
- Page briefly shows: "Thank You! Your feedback is greatly appreciated!"
- Message: "Redirecting to review site..." (animating)

**After 2.5 seconds**:
- Browser redirects to: `https://g.page/test-business` ✅
- Your Google Business profile should load

### Verify in Database

```sql
SELECT id, requestId, rating, redirectedToPublic, redirectedUrl, sentToPrivate 
FROM "ReviewResponse" 
WHERE requestId = 1;
```

**Expected**:
```
id | requestId | rating | redirectedToPublic | redirectedUrl              | sentToPrivate
----+-----------+--------+--------------------+----------------------------+-----------
1  | 1         | 5      | true               | https://g.page/test-business | false
```

✅ **Positive rating correctly routed to public review**

---

## Part 8: Test 5 - Submit 2-Star Rating (Negative Path)

### Create Another Request

```bash
curl -X POST http://localhost:3000/api/webhook/job-completed \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Test Business",
    "customerName": "John Smith",
    "customerEmail": "john@example.com",
    "customerPhone": "+15559876543",
    "jobCompletedAt": "2024-07-05T16:00:00Z",
    "webhookSecret": "'$WEBHOOK_SECRET'"
  }'
```

**Response**:
```json
{
  "success": true,
  "requestId": 2,
  "message": "Review request scheduled to be sent in 1 hours"
}
```

### Open the New Rating Form

```
http://localhost:3000/rate/2
```

### Submit 2-Star Rating

1. Click 2nd star (negative rating)
2. Type feedback: "Service was too slow"
3. Click **"Submit Rating"**

### What You Should See

**Immediate**:
- Shows "Thank You!" page
- **NOT** redirecting anywhere
- Message: "Your feedback has been received. The business owner will review it shortly and reach out if needed." ✅
- Page stays on Thank You screen (no redirect)

### Verify in Database

```sql
SELECT id, requestId, rating, redirectedToPublic, redirectedUrl, sentToPrivate, privateEmailSentAt 
FROM "ReviewResponse" 
WHERE requestId = 2;
```

**Expected**:
```
id | requestId | rating | redirectedToPublic | redirectedUrl | sentToPrivate | privateEmailSentAt
----+-----------+--------+--------------------+---------------+---------------+-------------------
2  | 2         | 2      | false              | null          | true          | 2024-07-05 16:30:00
```

✅ **Negative rating correctly routed to private feedback**

---

## Part 9: Test 6 - Check Email Was Sent

### Using Resend (Recommended)

1. Go to: `https://dashboard.resend.com/emails`
2. Look for email sent to `owner@test.com`
3. Verify:
   - ✅ Subject: "New 2-star feedback from customer"
   - ✅ From: noreply@yourdomain.com
   - ✅ Contains: "John Smith", "2 out of 5 stars", "Service was too slow"

### Using Your Email Inbox

Check your email at `owner@test.com`:
- ✅ Should have received email with 2-star feedback
- ✅ Email contains customer name and feedback text
- ✅ Email addresses the business owner

### Check Email Logs (Docker/Local)

If running locally, check Resend test mode logs:
```bash
# Check recent logs
docker logs -f container_name | grep -i email

# Or check Resend API responses
curl https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY"
```

✅ **Private feedback email confirmed sent**

---

## Part 10: Test 7 - Verify Logging

### Check Response Logging

```sql
-- Count all responses
SELECT COUNT(*) FROM "ReviewResponse";

-- Expected: 2 (one 5-star, one 2-star)

-- Show all responses with details
SELECT 
  rsp.id,
  rr.customerName,
  rsp.rating,
  CASE 
    WHEN rsp.redirectedToPublic THEN 'Public Review'
    WHEN rsp.sentToPrivate THEN 'Private Feedback'
    ELSE 'Unknown'
  END as routing_type,
  rsp.feedbackText
FROM "ReviewResponse" rsp
JOIN "ReviewRequest" rr ON rsp.requestId = rr.id;
```

**Expected Output**:
```
id | customerName | rating | routing_type    | feedbackText
----+--------------+--------+-----------------+---------------------
1  | Jane Doe     | 5      | Public Review   | This was great!
2  | John Smith   | 2      | Private Feedback| Service was too slow
```

### Check Analytics

```bash
curl -H "Authorization: Bearer $ADMIN_KEY" \
  http://localhost:3000/api/admin/analytics
```

**Expected Response**:
```json
{
  "overall": {
    "totalRequests": 2,
    "sentRequests": 0,
    "ratedRequests": 2,
    "responseRate": "100.00",
    "averageRating": "3.50",
    "ratingDistribution": {
      "onestar": 0,
      "twostar": 1,
      "threestar": 0,
      "fourstar": 0,
      "fivestar": 1
    },
    "publicReviews": 1,
    "privateReviews": 1
  }
}
```

✅ **All logging and analytics working**

---

## Part 11: Test 8 - Verify Delay Timer Works

### Create Request with 0 Hour Delay (Immediate)

```bash
curl -X POST http://localhost:3000/api/admin/clients \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -d '{
    "name": "Fast Business",
    "businessEmail": "fast@test.com",
    "delayHours": 0,
    "messageTemplate": "Rate us: {link}",
    "googleReviewUrl": "https://g.page/fast"
  }'
```

Save the webhook secret from response.

### Send Webhook to This Client

```bash
curl -X POST http://localhost:3000/api/webhook/job-completed \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Fast Business",
    "customerName": "Bob Quick",
    "customerEmail": "bob@example.com",
    "jobCompletedAt": "2024-07-05T17:00:00Z",
    "webhookSecret": "FAST_BUSINESS_SECRET"
  }'
```

**Response should say**: "Review request scheduled to be sent in 0 hours" ✅

### Verify in Database

```sql
SELECT id, jobCompletedAt, sendAfter 
FROM "ReviewRequest" 
WHERE customerName = 'Bob Quick';
```

**Expected**:
```
id | jobCompletedAt      | sendAfter
----+---------------------+---------------------
3  | 2024-07-05 17:00:00 | 2024-07-05 17:00:00
```

Notice: jobCompletedAt **equals** sendAfter (no delay) ✅

### Trigger Background Job

```bash
JOB_KEY="your-review-job-api-key"

curl -X POST http://localhost:3000/api/jobs/send-review-requests \
  -H "Authorization: Bearer $JOB_KEY"
```

**Expected Response**:
```json
{
  "success": true,
  "processed": 1,
  "successCount": 1,
  "failureCount": 0
}
```

✅ **Email sent immediately (0 hour delay worked)**

### Verify Email Sent

Check `bob@example.com` received email OR check Resend dashboard:
- ✅ Email received
- ✅ Contains message: "Rate us: http://localhost:3000/rate/3"
- ✅ Link is clickable

✅ **Delay timer and background job working**

---

## Part 12: Test 9 - Different Clients Different Configs

### Create Second Client

```bash
curl -X POST http://localhost:3000/api/admin/clients \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -d '{
    "name": "Other Business",
    "businessEmail": "other@test.com",
    "delayHours": 3,
    "messageTemplate": "Hello {customerName}, rate Other Business: {link}",
    "googleReviewUrl": "https://g.page/other-business"
  }'
```

### Send Webhooks to Both Clients

**Test Business (1 hour delay)**:
```bash
curl -X POST http://localhost:3000/api/webhook/job-completed \
  -d '{"businessName": "Test Business", "customerName": "Alice", "customerEmail": "alice@test.com", "jobCompletedAt": "2024-07-05T18:00:00Z", "webhookSecret": "TEST_SECRET"}'
```
Response: "scheduled to be sent in 1 hours" ✅

**Other Business (3 hour delay)**:
```bash
curl -X POST http://localhost:3000/api/webhook/job-completed \
  -d '{"businessName": "Other Business", "customerName": "Charlie", "customerEmail": "charlie@test.com", "jobCompletedAt": "2024-07-05T18:00:00Z", "webhookSecret": "OTHER_SECRET"}'
```
Response: "scheduled to be sent in 3 hours" ✅

### Verify Delays Are Different

```sql
SELECT 
  rc.name as businessName,
  rc.delayHours,
  EXTRACT(EPOCH FROM (rr.sendAfter - rr.jobCompletedAt)) / 3600 as actual_delay
FROM "ReviewRequest" rr
JOIN "ReviewClient" rc ON rr.clientId = rc.id
WHERE rr.customerName IN ('Alice', 'Charlie');
```

**Expected**:
```
businessName    | delayHours | actual_delay
----------------+------------+-------------
Test Business   | 1          | 1
Other Business  | 3          | 3
```

✅ **Each client has independent delay configuration**

### Verify Branding on Rating Pages

**Test Business Rating Page**:
```
http://localhost:3000/rate/[test-business-requestId]
```
Should show: **"Rating for Test Business"** ✅

**Other Business Rating Page**:
```
http://localhost:3000/rate/[other-business-requestId]
```
Should show: **"Rating for Other Business"** ✅

✅ **Business name branding per client verified**

---

## Part 13: Complete Verification Checklist

Use this to confirm everything is working:

```
✅ Setup & Infrastructure
  □ Node/npm installed
  □ Database connected (migrations run)
  □ Dev server running on http://localhost:3000
  □ Environment variables set

✅ Database Tables
  □ ReviewClient table exists
  □ ReviewRequest table exists
  □ ReviewResponse table exists
  □ All tables are empty initially

✅ Client Creation
  □ Can create a client with POST /api/admin/clients
  □ Receives webhookSecret in response
  □ All fields stored in database
  □ Can retrieve client with GET /api/admin/clients/[id]

✅ Webhook Processing
  □ Webhook accepted at POST /api/webhook/job-completed
  □ Webhook secret validated
  □ Review request created in database
  □ Delay calculated correctly (jobCompletedAt + delayHours)
  □ Returns correct requestId

✅ Rating Form
  □ Page loads at /rate/[requestId]
  □ Shows business name at top
  □ 5 stars clickable and interactive
  □ Stars turn gold on selection
  □ Feedback textarea appears after star selection
  □ Submit button disabled until rating selected

✅ Positive Rating (4-5 stars)
  □ Clicking 5 stars shows "Thank You"
  □ Page redirects to Google review link after 2.5 seconds
  □ ReviewResponse created in database
  □ redirectedToPublic = true
  □ redirectedUrl set to Google link

✅ Negative Rating (1-3 stars)
  □ Clicking 2 stars shows "Thank You"
  □ NO redirect (stays on thank you page)
  □ ReviewResponse created in database
  □ sentToPrivate = true
  □ Email sent to business owner
  □ Email contains customer name, rating, feedback

✅ Email Delivery
  □ Email arrives in business owner inbox
  □ Email contains customer feedback
  □ Email subject indicates star rating
  □ Can verify in Resend dashboard

✅ Logging & Analytics
  □ Each response logged in ReviewResponse table
  □ Can retrieve analytics with GET /api/admin/analytics
  □ Response rate calculated correctly
  □ Average rating calculated correctly
  □ Public vs private count correct

✅ Delay Timer
  □ Request with 0 hour delay sends immediately
  □ Request with 3 hour delay waits 3 hours
  □ Background job triggered with POST /api/jobs/send-review-requests
  □ Job runs with authorization header

✅ Multi-Tenant Configuration
  □ Can create multiple clients
  □ Each client has independent configuration
  □ Each client has unique webhook secret
  □ Each client has unique review links
  □ Each client has unique delay times
  □ Each client has unique message templates
  □ Rating pages show correct business name per client
  □ Emails sent to correct owner per client
  □ No data leaks between clients
```

---

## Success Criteria: How to Know It's FULLY Working

✅ **You have full confidence the system is working when:**

1. ✅ You can create a client and get back all fields + webhook secret
2. ✅ You can send a webhook and it creates a ReviewRequest with correct delay
3. ✅ You can open /rate/[requestId] and see the business name displayed
4. ✅ You can click 5 stars and get redirected to Google review link
5. ✅ You can click 2 stars and see private feedback message (no redirect)
6. ✅ Business owner receives email with negative feedback
7. ✅ Database shows response logged correctly (rating + routing path)
8. ✅ Analytics API returns correct statistics
9. ✅ Different clients have independent configurations
10. ✅ Background job sends emails at the right delay times

**If all 10 are working → Your system is production-ready! 🚀**

---

## Troubleshooting: If Something Doesn't Work

### API returns 401 Unauthorized
```
❌ Problem: Authorization header rejected
✅ Solution: Check ADMIN_API_KEY or REVIEW_JOB_API_KEY in .env.local
✅ Make sure to use: -H "Authorization: Bearer YOUR_KEY"
```

### API returns 500 Internal Server Error
```
❌ Problem: Server crashed
✅ Solution: Check console for errors
✅ Check database connection: DATABASE_URL set correctly?
✅ Check Resend API key if email failed
```

### Rating form shows "Loading..."
```
❌ Problem: Page stuck loading
✅ Solution: Check browser console (F12) for errors
✅ Database might be slow to respond
✅ Try refreshing page
```

### Email not received
```
❌ Problem: Email not in inbox
✅ Solution 1: Check spam folder
✅ Solution 2: Verify Resend dashboard shows email was sent
✅ Solution 3: Check RESEND_API_KEY is valid
✅ Solution 4: Check RESEND_FROM_EMAIL is verified in Resend
```

### Business name not showing on rating page
```
❌ Problem: Page shows generic "How was your service?"
✅ Solution: Check browser console for API errors
✅ Check database has ReviewRequest + ReviewClient records
✅ Check GET /api/rate/[requestId] returns businessName
```

---

## Need More Help?

1. **Check the logs**: `npm run dev` shows errors in console
2. **Check the database**: Query tables directly to see what was stored
3. **Check the API responses**: Use curl commands to see exact error messages
4. **Check the browser console**: F12 → Console tab for client-side errors
5. **Review TEST_VERIFICATION_REPORT.md**: Full verification details
6. **Review E2E_TEST_GUIDE.md**: Step-by-step testing scenarios
7. **Review TEST_CLIENT_CONFIGURATION.md**: Multi-tenant configuration testing
