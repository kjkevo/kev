# End-to-End Testing Guide

This guide walks through testing each core function of the Review Reputation Automation system.

## Prerequisites

1. Database set up (Supabase/Railway)
2. Resend API key configured
3. (Optional) Twilio credentials for SMS testing
4. Admin API key and Job API key set in environment

## Test Scenarios

### ✅ Test 1: Webhook Receives Job Completion

**Objective**: Verify that webhook correctly accepts and stores job completion events.

**Steps**:
1. Create a test client via admin API:
```bash
curl -X POST http://localhost:3000/api/admin/clients \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Business",
    "businessEmail": "owner@test.com",
    "delayHours": 0,
    "messageTemplate": "Hi {customerName}, rate {businessName}: {link}",
    "googleReviewUrl": "https://g.page/test"
  }'
```

2. Save the `webhookSecret` from response

3. Send test webhook:
```bash
curl -X POST http://localhost:3000/api/webhook/job-completed \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Test Business",
    "customerName": "Jane Doe",
    "customerEmail": "jane@example.com",
    "customerPhone": "+15551234567",
    "jobCompletedAt": "2024-07-05T14:00:00Z",
    "webhookSecret": "YOUR_WEBHOOK_SECRET"
  }'
```

**Expected Result**:
```json
{
  "success": true,
  "requestId": 1,
  "message": "Review request scheduled to be sent in 0 hours"
}
```

**Pass Criteria**:
- ✅ Returns 201 status
- ✅ Returns requestId
- ✅ Database stores ReviewRequest with correct data

---

### ✅ Test 2: Delay Timer Calculation

**Objective**: Verify that requests are scheduled for the correct time.

**Steps**:
1. Modify client to have `delayHours: 3`
2. Send webhook with current timestamp
3. Check database for ReviewRequest
4. Verify `sendAfter` is 3 hours in the future

**SQL Check**:
```sql
SELECT id, jobCompletedAt, sendAfter, 
  EXTRACT(EPOCH FROM (sendAfter - jobCompletedAt)) / 3600 as delay_hours
FROM "ReviewRequest"
ORDER BY createdAt DESC LIMIT 1;
```

**Expected Result**:
```
id | jobCompletedAt | sendAfter | delay_hours
1  | 2024-07-05 14:00 | 2024-07-05 17:00 | 3
```

**Pass Criteria**:
- ✅ `sendAfter` is exactly `delayHours` in the future
- ✅ Request has `sent = false` initially
- ✅ Request has `sentAt = null` initially

---

### ✅ Test 3: Email Sends with Working Link

**Objective**: Verify review request email is sent with correct rating link.

**Steps**:
1. Set `delayHours: 0` so request sends immediately
2. Call background job:
```bash
curl -X POST http://localhost:3000/api/jobs/send-review-requests \
  -H "Authorization: Bearer YOUR_JOB_API_KEY"
```

3. Check Resend dashboard or email logs

**Expected Email**:
- ✅ Recipient: customer email from webhook
- ✅ Subject: "We'd love your feedback on our service"
- ✅ Contains message template with {link} replaced
- ✅ Contains clickable link to rating form: `http://localhost:3000/rate/[requestId]`
- ✅ Professional HTML formatting with CTA button

**Pass Criteria**:
- ✅ Email successfully sent
- ✅ Link works when clicked
- ✅ Rating form loads for valid requestId

---

### ✅ Test 4: Rating Form Loads

**Objective**: Verify the rating form is accessible and functional.

**Steps**:
1. Get requestId from webhook response or database
2. Visit: `http://localhost:3000/rate/1`
3. Observe form

**Expected Behavior**:
- ✅ Page loads without errors
- ✅ Shows "How was your service?" heading
- ✅ Displays 5 clickable stars
- ✅ Stars change color on hover
- ✅ Can select multiple stars (rating persists)
- ✅ Optional feedback textarea appears after star selection

**Pass Criteria**:
- ✅ Form is accessible and responsive
- ✅ Can select ratings 1-5
- ✅ Can add optional feedback text

---

### ✅ Test 5: 4-5 Star Rating Redirects to Public Review

**Objective**: Verify high ratings are routed to public review sites.

**Steps**:
1. Open rating form: `http://localhost:3000/rate/1`
2. Select 5 stars
3. Leave feedback text: "Excellent service!"
4. Click "Submit Rating"

**Expected Behavior**:
- ✅ Loading state shows "Submitting..."
- ✅ Success screen appears: "Thank You!"
- ✅ Screen shows "Redirecting to review site..." message
- ✅ After ~2.5 seconds, redirects to Google Review link
- ✅ URL changes to: `https://g.page/test` (or Yelp URL)

**Database Check**:
```sql
SELECT * FROM "ReviewResponse" 
WHERE requestId = 1;
```

**Expected Data**:
```
id | requestId | rating | redirectedToPublic | redirectedUrl | sentToPrivate
1  | 1         | 5      | true               | https://g.page/test | false
```

**Pass Criteria**:
- ✅ Customer redirected to public review link
- ✅ Response recorded in database
- ✅ `redirectedToPublic = true`
- ✅ `sentToPrivate = false`

---

### ✅ Test 6: 1-3 Star Rating Routes to Private Feedback

**Objective**: Verify low ratings are routed to private feedback.

**Steps**:
1. Send new webhook for another customer
2. Open rating form for new request: `http://localhost:3000/rate/2`
3. Select 2 stars
4. Add feedback: "Poor quality, needs improvement"
5. Click "Submit Rating"

**Expected Behavior**:
- ✅ Loading state shows "Submitting..."
- ✅ Success screen appears with message: "Your feedback has been received. The business owner will review it shortly."
- ✅ **NO redirect** to public review site

**Email Check**:
- ✅ Business owner receives email at `owner@test.com`
- ✅ Email subject: "New 2-star feedback from customer"
- ✅ Email shows: customer name, rating, feedback text
- ✅ Email encourages owner to reach out to customer

**Database Check**:
```sql
SELECT * FROM "ReviewResponse" 
WHERE requestId = 2;
```

**Expected Data**:
```
id | requestId | rating | redirectedToPublic | redirectedUrl | sentToPrivate | privateEmailSentAt
2  | 2         | 2      | false              | null          | true          | 2024-07-05 14:30:00
```

**Pass Criteria**:
- ✅ Customer NOT redirected to public review
- ✅ Response recorded with `sentToPrivate = true`
- ✅ Private feedback email sent to business owner
- ✅ Email contains all customer feedback details

---

### ✅ Test 7: Response Logging & Analytics

**Objective**: Verify all responses are logged and analytics are correct.

**Steps**:
1. Submit several ratings (mix of positive and negative)
2. Call analytics API:
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  http://localhost:3000/api/admin/analytics
```

**Expected Response**:
```json
{
  "overall": {
    "totalRequests": 3,
    "sentRequests": 3,
    "ratedRequests": 2,
    "responseRate": "66.67",
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
  },
  "byClient": [
    {
      "clientId": 1,
      "clientName": "Test Business",
      "totalRequests": 3,
      "sentRequests": 3,
      "ratedRequests": 2,
      "averageRating": "3.50"
    }
  ]
}
```

**Pass Criteria**:
- ✅ All submitted ratings recorded
- ✅ Response rate calculated correctly
- ✅ Average rating includes all ratings
- ✅ Rating distribution accurate
- ✅ Public/private split correct
- ✅ Per-client stats accurate

---

### ✅ Test 8: SMS Delivery (Optional)

**Objective**: Verify SMS fallback for customers without email.

**Steps**:
1. Send webhook with ONLY phone number (no email):
```bash
curl -X POST http://localhost:3000/api/webhook/job-completed \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Test Business",
    "customerName": "John Smith",
    "customerPhone": "+1234567890",
    "jobCompletedAt": "2024-07-05T14:00:00Z",
    "webhookSecret": "YOUR_WEBHOOK_SECRET"
  }'
```

2. Call background job
3. Check Twilio logs

**Expected Behavior**:
- ✅ Email not attempted (no email provided)
- ✅ SMS sent to phone number
- ✅ SMS contains message template with rating link
- ✅ Link is clickable and works

**Pass Criteria**:
- ✅ SMS sent when email unavailable
- ✅ Phone number validation works
- ✅ Link in SMS leads to functional rating form

---

### ✅ Test 9: Duplicate Rating Prevention

**Objective**: Verify customers can't rate twice.

**Steps**:
1. Submit rating for requestId 1 (5 stars)
2. Go back to rating form: `http://localhost:3000/rate/1`
3. Try to submit different rating (1 star)

**Expected Behavior**:
- ✅ Error message: "You have already submitted a rating for this review"
- ✅ Form does not submit
- ✅ HTTP status: 409 Conflict

**Database Check**:
```sql
SELECT COUNT(*) FROM "ReviewResponse" 
WHERE requestId = 1;
```

**Expected Result**: `1` (only one response per request)

**Pass Criteria**:
- ✅ Only one response per request allowed
- ✅ Duplicate attempts rejected with 409
- ✅ Original rating preserved

---

### ✅ Test 10: Invalid RequestId Handling

**Objective**: Verify proper error handling for invalid requests.

**Steps**:
1. Visit: `http://localhost:3000/rate/999999`
2. Try to submit rating

**Expected Behavior**:
- ✅ Error message: "Review request not found"
- ✅ HTTP status: 404 Not Found
- ✅ Form prevents submission

**Pass Criteria**:
- ✅ Non-existent requests handled gracefully
- ✅ Appropriate error message shown
- ✅ No database errors in logs

---

## Test Checklist

Use this to track progress:

```
Core Functionality:
- [ ] Test 1: Webhook accepts job completion
- [ ] Test 2: Delay timer calculates correctly
- [ ] Test 3: Email sends with valid rating link
- [ ] Test 4: Rating form loads and is functional
- [ ] Test 5: Positive (4-5) ratings redirect to public review
- [ ] Test 6: Negative (1-3) ratings route to private feedback
- [ ] Test 7: All responses logged and analytics calculated
- [ ] Test 8: SMS sends to customers without email
- [ ] Test 9: Duplicate ratings rejected
- [ ] Test 10: Invalid requests handled gracefully

Edge Cases:
- [ ] Webhook with invalid secret rejected
- [ ] Missing required fields rejected
- [ ] Invalid rating values rejected
- [ ] Business not found error
- [ ] Email service failure handled gracefully
- [ ] SMS service failure handled gracefully
- [ ] Database connection errors handled

Production Readiness:
- [ ] All error messages are user-friendly
- [ ] Performance acceptable for 1000+ requests
- [ ] Cron job runs reliably
- [ ] Logs useful for debugging
- [ ] Admin API properly secured
- [ ] Job API properly secured
```

---

## Troubleshooting

### Email not sending
- Check Resend API key is valid
- Verify `RESEND_FROM_EMAIL` is verified in Resend dashboard
- Check email goes to spam folder
- Review Resend dashboard for bounce reasons

### SMS not sending
- Verify Twilio credentials
- Check phone number format includes country code
- Verify Twilio trial credits haven't expired
- Check Twilio logs for errors

### Background job not running
- Verify Vercel cron is enabled
- Check job authorization header in cron config
- Verify `REVIEW_JOB_API_KEY` environment variable is set
- Check function logs for errors

### Ratings not appearing
- Verify customer clicked rating form link
- Check browser console for JavaScript errors
- Verify database connection working
- Check API logs for 500 errors

### Redirects not working
- Verify Google/Yelp URLs are valid and accessible
- Check browser popup blocker isn't preventing redirect
- Verify `redirectedToPublic` is true in database
- Check response includes `redirectUrl` field
