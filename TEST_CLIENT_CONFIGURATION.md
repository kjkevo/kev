# Testing Client Configuration & Branding

This guide tests that each client has independent, customizable configurations and that branding appears on the rating page.

---

## Test 1: Create Multiple Clients with Different Configs

### Setup

Create Client 1 (ABC Plumbing):
```bash
ADMIN_KEY="your-admin-api-key"

curl -X POST http://localhost:3000/api/admin/clients \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC Plumbing",
    "businessEmail": "owner@abcplumbing.com",
    "contactName": "John Smith",
    "delayHours": 3,
    "messageTemplate": "Hi {customerName}, thank you for choosing ABC Plumbing! Rate your experience here: {link}",
    "googleReviewUrl": "https://g.page/abc-plumbing-co",
    "yelpReviewUrl": "https://yelp.com/biz/abc-plumbing"
  }'
```

**Response** (save the webhookSecret):
```json
{
  "id": 1,
  "name": "ABC Plumbing",
  "delayHours": 3,
  "messageTemplate": "Hi {customerName}, thank you for choosing ABC Plumbing! Rate your experience here: {link}",
  "webhookSecret": "abc123secret..."
}
```

Create Client 2 (XYZ Electric):
```bash
curl -X POST http://localhost:3000/api/admin/clients \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "XYZ Electric",
    "businessEmail": "support@xyzelectric.com",
    "contactName": "Sarah Johnson",
    "delayHours": 1,
    "messageTemplate": "Hey {customerName}! We'd love to hear about your experience with XYZ Electric. Click here to rate: {link}",
    "googleReviewUrl": "https://g.page/xyz-electric",
    "yelpReviewUrl": null
  }'
```

Create Client 3 (Quick Repairs):
```bash
curl -X POST http://localhost:3000/api/admin/clients \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Quick Repairs",
    "businessEmail": "feedback@quickrepairs.com",
    "contactName": "Mike Davis",
    "delayHours": 0,
    "messageTemplate": "Thanks {customerName}! How'd we do? {link}",
    "googleReviewUrl": "https://g.page/quick-repairs",
    "yelpReviewUrl": "https://yelp.com/biz/quick-repairs"
  }'
```

### ✅ Verify All Clients Created

```bash
curl -H "Authorization: Bearer $ADMIN_KEY" \
  http://localhost:3000/api/admin/clients
```

**Expected Response**:
```json
[
  {
    "id": 1,
    "name": "ABC Plumbing",
    "businessEmail": "owner@abcplumbing.com",
    "delayHours": 3,
    ...
  },
  {
    "id": 2,
    "name": "XYZ Electric",
    "businessEmail": "support@xyzelectric.com",
    "delayHours": 1,
    ...
  },
  {
    "id": 3,
    "name": "Quick Repairs",
    "businessEmail": "feedback@quickrepairs.com",
    "delayHours": 0,
    ...
  }
]
```

**Verification**:
- ✅ All 3 clients created
- ✅ Each has unique name
- ✅ Each has different delayHours (0, 1, 3)
- ✅ Each has unique business email
- ✅ Each has unique message template

---

## Test 2: Verify Configuration Persists

### Get Individual Client Details

```bash
curl -H "Authorization: Bearer $ADMIN_KEY" \
  http://localhost:3000/api/admin/clients/1
```

**Expected Response**:
```json
{
  "client": {
    "id": 1,
    "name": "ABC Plumbing",
    "businessEmail": "owner@abcplumbing.com",
    "contactName": "John Smith",
    "delayHours": 3,
    "messageTemplate": "Hi {customerName}, thank you for choosing ABC Plumbing! Rate your experience here: {link}",
    "googleReviewUrl": "https://g.page/abc-plumbing-co",
    "yelpReviewUrl": "https://yelp.com/biz/abc-plumbing",
    "enabled": true
  },
  "stats": {
    "totalRequests": 0,
    "sentRequests": 0,
    "ratedRequests": 0,
    "averageRating": null
  }
}
```

**Verification**:
- ✅ All configuration fields returned correctly
- ✅ Business name matches input
- ✅ Delay hours matches input
- ✅ Message template matches input
- ✅ Review URLs match input

---

## Test 3: Send Webhooks to Different Clients

### Send webhook to ABC Plumbing (3 hour delay)

```bash
WEBHOOK_SECRET_1="abc123secret..." # from Client 1 creation

curl -X POST http://localhost:3000/api/webhook/job-completed \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "ABC Plumbing",
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "customerPhone": "+15551234567",
    "jobCompletedAt": "2024-07-05T14:00:00Z",
    "webhookSecret": "'$WEBHOOK_SECRET_1'"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "requestId": 1,
  "message": "Review request scheduled to be sent in 3 hours"
}
```

### Send webhook to XYZ Electric (1 hour delay)

```bash
WEBHOOK_SECRET_2="xyz789secret..." # from Client 2 creation

curl -X POST http://localhost:3000/api/webhook/job-completed \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "XYZ Electric",
    "customerName": "Jane Smith",
    "customerEmail": "jane@example.com",
    "customerPhone": "+15559876543",
    "jobCompletedAt": "2024-07-05T15:00:00Z",
    "webhookSecret": "'$WEBHOOK_SECRET_2'"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "requestId": 2,
  "message": "Review request scheduled to be sent in 1 hours"
}
```

### Send webhook to Quick Repairs (0 hour delay - immediate)

```bash
WEBHOOK_SECRET_3="quick999secret..." # from Client 3 creation

curl -X POST http://localhost:3000/api/webhook/job-completed \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Quick Repairs",
    "customerName": "Bob Johnson",
    "customerEmail": "bob@example.com",
    "customerPhone": "+15552223333",
    "jobCompletedAt": "2024-07-05T16:00:00Z",
    "webhookSecret": "'$WEBHOOK_SECRET_3'"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "requestId": 3,
  "message": "Review request scheduled to be sent in 0 hours"
}
```

### ✅ Verify Requests Stored with Correct Delays

```sql
-- Check delays are correct
SELECT 
  rr.id,
  rr.customerName,
  rc.name as businessName,
  rc.delayHours,
  rr.jobCompletedAt,
  rr.sendAfter,
  EXTRACT(EPOCH FROM (rr.sendAfter - rr.jobCompletedAt)) / 3600 as actual_delay_hours
FROM "ReviewRequest" rr
JOIN "ReviewClient" rc ON rr.clientId = rc.id
ORDER BY rr.id;
```

**Expected Result**:
```
id | customerName | businessName   | delayHours | jobCompletedAt      | sendAfter           | actual_delay_hours
1  | John Doe     | ABC Plumbing   | 3          | 2024-07-05 14:00:00 | 2024-07-05 17:00:00 | 3
2  | Jane Smith   | XYZ Electric   | 1          | 2024-07-05 15:00:00 | 2024-07-05 16:00:00 | 1
3  | Bob Johnson  | Quick Repairs  | 0          | 2024-07-05 16:00:00 | 2024-07-05 16:00:00 | 0
```

**Verification**:
- ✅ ABC Plumbing delay = 3 hours
- ✅ XYZ Electric delay = 1 hour
- ✅ Quick Repairs delay = 0 hours (immediate)
- ✅ Each client's delay applied independently

---

## Test 4: Verify Message Template Rendering

### Check message for ABC Plumbing

```sql
SELECT 
  rr.id,
  rc.name,
  rc.messageTemplate,
  rr.customerName,
  rr.jobCompletedAt
FROM "ReviewRequest" rr
JOIN "ReviewClient" rc ON rr.clientId = rc.id
WHERE rc.id = 1;
```

**Expected**:
```
id | name          | messageTemplate
1  | ABC Plumbing  | Hi {customerName}, thank you for choosing ABC Plumbing! Rate your experience here: {link}
```

**Template Variables to Replace**:
- `{customerName}` → "John Doe"
- `{link}` → "http://localhost:3000/rate/1"
- `{businessName}` → "ABC Plumbing"

**Expected Rendered Message**:
```
Hi John Doe, thank you for choosing ABC Plumbing! Rate your experience here: http://localhost:3000/rate/1
```

### Check message for XYZ Electric

**Expected Rendered Message**:
```
Hey Jane Smith! We'd love to hear about your experience with XYZ Electric. Click here to rate: http://localhost:3000/rate/2
```

### Check message for Quick Repairs

**Expected Rendered Message**:
```
Thanks Bob Johnson! How'd we do? http://localhost:3000/rate/3
```

---

## Test 5: Rating Page Shows Correct Business Name & Branding

This is the critical test for per-client branding.

### Understanding the Rating Page

**Current State**: The rating page (`/rate/[requestId]`) shows a generic "How was your service?" form.

**What We Need to Add**: Display the business name on the rating page per client.

### Enhancement: Business Name Display (Already Implemented ✅)

The rating page now fetches and displays the business name per client. Here's how to test it:

### Test 5a: API Endpoint Returns Business Info

```bash
curl http://localhost:3000/api/rate/1
```

**Expected Response**:
```json
{
  "businessName": "ABC Plumbing",
  "businessEmail": "owner@abcplumbing.com",
  "customerName": "John Doe"
}
```

**Verification**:
- ✅ Returns correct business name
- ✅ Returns business email
- ✅ Returns customer name from webhook

```bash
curl http://localhost:3000/api/rate/2
```

**Expected Response**:
```json
{
  "businessName": "XYZ Electric",
  "businessEmail": "support@xyzelectric.com",
  "customerName": "Jane Smith"
}
```

**Verification**:
- ✅ Different business name for different request
- ✅ Each request returns its own client's details

### Test 5b: Rating Page Displays Business Name

Open each rating page in browser:

**ABC Plumbing Rating Page**:
```
http://localhost:3000/rate/1
```

**Visual Elements**:
```
┌─────────────────────────────────┐
│                                 │
│    Rating for                   │
│    ABC Plumbing                 │ ← Business name displayed here
│                                 │
│  How was your service?          │
│  We'd love your feedback        │
│                                 │
│   ★ ★ ★ ★ ★                    │
│                                 │
│  [Submit Rating]                │
└─────────────────────────────────┘
```

**Verification**:
- ✅ Business name "ABC Plumbing" visible
- ✅ Styled with indigo color (#6366F1)
- ✅ Shows "Rating for" label
- ✅ Appears above the rating question

**XYZ Electric Rating Page**:
```
http://localhost:3000/rate/2
```

**Visual Elements**:
```
┌─────────────────────────────────┐
│                                 │
│    Rating for                   │
│    XYZ Electric                 │ ← Different business name
│                                 │
│  How was your service?          │
│  We'd love your feedback        │
│                                 │
│   ★ ★ ★ ★ ★                    │
│                                 │
│  [Submit Rating]                │
└─────────────────────────────────┘
```

**Verification**:
- ✅ Business name "XYZ Electric" visible
- ✅ Same styling as ABC Plumbing
- ✅ Different from first page

**Quick Repairs Rating Page**:
```
http://localhost:3000/rate/3
```

**Expected Business Name**: "Quick Repairs"

**Verification**:
- ✅ All three clients display their own business name
- ✅ No branding leakage between clients

---

## Test 6: Verify Message Template Used for Email

### Trigger Email Sending

For Quick Repairs (0 hour delay - email should send immediately):

```bash
curl -X POST http://localhost:3000/api/jobs/send-review-requests \
  -H "Authorization: Bearer $JOB_API_KEY"
```

### Check Sent Email

**Expected Email to Bob Johnson** (Quick Repairs customer):

**Subject**: "We'd love your feedback on our service"

**Email Body**:
```
How was your service?

Thanks Bob Johnson! How'd we do? http://localhost:3000/rate/3

[Leave a Rating button]

This is an automated message. Please do not reply to this email.
```

**Verification**:
- ✅ Message template used: "Thanks {customerName}! How'd we do? {link}"
- ✅ {customerName} replaced with "Bob Johnson"
- ✅ {link} replaced with working URL
- ✅ Business name not in message (because template doesn't include {businessName})

### Optional: Add Business Name to Template

To include business name in email, modify the message template:

```bash
curl -X PUT http://localhost:3000/api/admin/clients/3 \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messageTemplate": "Hi {customerName}, thank you for choosing {businessName}! How'd we do? {link}"
  }'
```

**Updated Email**:
```
Hi Bob Johnson, thank you for choosing Quick Repairs! How'd we do? http://localhost:3000/rate/3
```

**Verification**:
- ✅ Template can include {businessName} variable
- ✅ Variable replaced correctly in email
- ✅ Customer sees personalized message with their service provider

---

## Test 7: Update Configuration & Verify Changes

### Update ABC Plumbing Configuration

Change delay time and message:

```bash
curl -X PUT http://localhost:3000/api/admin/clients/1 \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "delayHours": 6,
    "messageTemplate": "Hello {customerName}! ABC Plumbing would love your feedback: {link}"
  }'
```

### Verify Update Applied

```bash
curl -H "Authorization: Bearer $ADMIN_KEY" \
  http://localhost:3000/api/admin/clients/1
```

**Expected Response**:
```json
{
  "client": {
    "id": 1,
    "name": "ABC Plumbing",
    "delayHours": 6,
    "messageTemplate": "Hello {customerName}! ABC Plumbing would love your feedback: {link}",
    ...
  }
}
```

**Verification**:
- ✅ Delay changed from 3 to 6 hours
- ✅ Message template updated
- ✅ Changes persist in database

### Send New Webhook with Updated Config

```bash
curl -X POST http://localhost:3000/api/webhook/job-completed \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "ABC Plumbing",
    "customerName": "Alice Williams",
    "customerEmail": "alice@example.com",
    "jobCompletedAt": "2024-07-05T20:00:00Z",
    "webhookSecret": "'$WEBHOOK_SECRET_1'"
  }'
```

**Expected**: 
- Message: "Review request scheduled to be sent in 6 hours" ✅

### Verify Delay Applied to New Request

```sql
SELECT 
  rr.id,
  rr.customerName,
  rc.delayHours,
  EXTRACT(EPOCH FROM (rr.sendAfter - rr.jobCompletedAt)) / 3600 as delay_hours
FROM "ReviewRequest" rr
JOIN "ReviewClient" rc ON rr.clientId = rc.id
WHERE rc.id = 1
ORDER BY rr.createdAt DESC LIMIT 1;
```

**Expected Result**:
```
id | customerName   | delayHours | delay_hours
4  | Alice Williams | 6          | 6
```

**Verification**:
- ✅ New request uses updated 6-hour delay
- ✅ Earlier request still has 3-hour delay
- ✅ Configuration changes apply to new requests only

---

## Test 8: Verify Multiple Clients Are Isolated

### Send Same Rating Value to Different Clients

**ABC Plumbing - 5 stars** (for requestId 1):
```bash
curl -X POST http://localhost:3000/api/rate/1 \
  -H "Content-Type: application/json" \
  -d '{"rating": 5, "feedbackText": "Great work!"}'
```

**Expected Redirect**: Google review link for ABC Plumbing

**XYZ Electric - 5 stars** (for requestId 2):
```bash
curl -X POST http://localhost:3000/api/rate/2 \
  -H "Content-Type: application/json" \
  -d '{"rating": 5, "feedbackText": "Excellent service!"}'
```

**Expected Redirect**: Google review link for XYZ Electric (different from ABC)

### Verify Database Shows Correct Redirects

```sql
SELECT 
  rr.id,
  rr.customerName,
  rc.name as businessName,
  rsp.rating,
  rsp.redirectedUrl
FROM "ReviewResponse" rsp
JOIN "ReviewRequest" rr ON rsp.requestId = rr.id
JOIN "ReviewClient" rc ON rr.clientId = rc.id
WHERE rsp.rating = 5
ORDER BY rr.id;
```

**Expected Result**:
```
id | customerName | businessName   | rating | redirectedUrl
1  | John Doe     | ABC Plumbing   | 5      | https://g.page/abc-plumbing-co
2  | Jane Smith   | XYZ Electric   | 5      | https://g.page/xyz-electric
```

**Verification**:
- ✅ Each client's review URL stored correctly
- ✅ No mixing of review links between clients
- ✅ Customers redirected to their own business's review page

---

## Test 9: Verify Business Email Isolation for Private Feedback

### Submit 2-Star Ratings for Different Clients

**ABC Plumbing - 2 stars**:
```bash
curl -X POST http://localhost:3000/api/rate/1 \
  -H "Content-Type: application/json" \
  -d '{"rating": 2, "feedbackText": "Did not meet expectations"}'
```

**XYZ Electric - 2 stars**:
```bash
curl -X POST http://localhost:3000/api/rate/2 \
  -H "Content-Type: application/json" \
  -d '{"rating": 2, "feedbackText": "Service took too long"}'
```

### Verify Private Emails Sent to Correct Owners

**Email 1**:
- **Recipient**: owner@abcplumbing.com ✅
- **Content**: Feedback from John Doe about ABC Plumbing

**Email 2**:
- **Recipient**: support@xyzelectric.com ✅
- **Content**: Feedback from Jane Smith about XYZ Electric

**Verification**:
- ✅ ABC Plumbing feedback goes to ABC's email only
- ✅ XYZ Electric feedback goes to XYZ's email only
- ✅ No email confusion between clients
- ✅ Business owners receive only their own feedback

---

## Complete Configuration Test Checklist

```
Configuration Creation:
- [ ] Client 1 (ABC Plumbing, 3 hour delay, Google + Yelp)
- [ ] Client 2 (XYZ Electric, 1 hour delay, Google only)
- [ ] Client 3 (Quick Repairs, 0 hour delay, Google + Yelp)
- [ ] All configs stored and retrievable

Configuration Independence:
- [ ] Each client has unique webhook secret
- [ ] Each client has unique review links
- [ ] Each client has unique message template
- [ ] Each client has unique delay time
- [ ] Each client has unique business email

API Response & Data:
- [ ] Webhook accepts requests for each business
- [ ] Correct delay applied per client
- [ ] Message template renders per client
- [ ] Rating form fetches correct business name
- [ ] Private feedback routed to correct email

Branding & UX:
- [ ] Rating page shows ABC Plumbing business name
- [ ] Rating page shows XYZ Electric business name
- [ ] Rating page shows Quick Repairs business name
- [ ] Each page styled consistently
- [ ] Business name displays for all three clients

Email Content:
- [ ] Email for ABC uses ABC's template
- [ ] Email for XYZ uses XYZ's template
- [ ] Email for Quick Repairs uses Quick Repairs' template
- [ ] Private feedback sent to correct business owner
- [ ] No leakage of data between clients

Configuration Updates:
- [ ] Can update delay time per client
- [ ] Can update message template per client
- [ ] Can update review links per client
- [ ] Updates apply to new requests only
- [ ] Old requests keep original config
```

---

## Success Criteria

Your system is fully configured and working correctly when:

1. ✅ Each client has independent, customizable settings
2. ✅ Rating page displays the correct business name for each client
3. ✅ Messages render with client-specific templates
4. ✅ Delays apply correctly per client configuration
5. ✅ Review redirects go to the right links per client
6. ✅ Private feedback reaches the correct business owner
7. ✅ No data leaks between clients
8. ✅ Configuration updates work correctly

If all checks pass, your **multi-tenant configuration system is production-ready**! 🎉
