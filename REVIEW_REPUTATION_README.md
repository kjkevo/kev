# Review & Reputation Management Automation

A production-ready system for automating post-service review requests and reputation management. Route positive feedback to public reviews (Google/Yelp) and negative feedback to private channels for direct business owner response.

## Features

- **Webhook-triggered**: Accepts job completion events from any service scheduling platform
- **Configurable delays**: Send review requests 3+ hours after job completion (customizable per client)
- **Smart routing**:
  - 4-5 stars → Direct to Google/Yelp public reviews
  - 1-3 stars → Private feedback form to business owner
- **Multi-channel delivery**: Email and SMS support
- **Complete logging**: Track all requests, responses, and routing decisions
- **Easy integration**: Simple REST API + admin dashboard
- **Vercel-ready**: Deploy in seconds to serverless infrastructure

## Prerequisites

### Required Accounts

1. **Database**: PostgreSQL (Supabase, Railway, or any Postgres provider)
2. **Email service**: [Resend](https://resend.com) (free tier: 100 emails/day)
3. **SMS service** (optional): [Twilio](https://www.twilio.com) (trial: $15 credit)
4. **Analytics** (optional): [Airtable](https://airtable.com) for logging reviews
5. **Deployment**: [Vercel](https://vercel.com) (free tier available)

### Environment Variables

Create a `.env.local` file with:

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/dbname
DIRECT_URL=postgresql://user:password@host:port/dbname

# Email (Resend)
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=noreply@yourdomain.com

# SMS (Twilio) - optional
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1234567890

# Admin/Background Job Security
ADMIN_API_KEY=your-secret-admin-key
REVIEW_JOB_API_KEY=your-secret-job-key

# App URL (for generating rating links)
NEXTAUTH_URL=https://yourdomain.com
```

## Setup Instructions

### 1. Database Setup

```bash
# Install dependencies
npm install

# Run migrations
npm run db:migrate
```

This creates:
- `ReviewClient` - Business configurations
- `ReviewRequest` - Incoming job completion events
- `ReviewResponse` - Customer ratings and feedback

### 2. Create a Client (Business)

Use the admin API to create a new business configuration:

```bash
curl -X POST http://localhost:3000/api/admin/clients \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC Plumbing",
    "businessEmail": "owner@abcplumbing.com",
    "contactName": "John Smith",
    "delayHours": 3,
    "messageTemplate": "Hi {customerName}, thank you for choosing {businessName}! We'd love your feedback: {link}",
    "googleReviewUrl": "https://g.page/abcplumbing",
    "yelpReviewUrl": "https://yelp.com/biz/abc-plumbing",
    "airtableBaseId": "appXxx" ,
    "airtableApiKey": "key_xxx"
  }'
```

Response includes:
```json
{
  "id": 1,
  "name": "ABC Plumbing",
  "webhookSecret": "abc123def456...",
  "message": "Client created successfully. Keep the webhook secret secure."
}
```

**Store the `webhookSecret`** - you'll need it when sending webhooks.

### 3. Send a Job Completion Webhook

Your service scheduling platform calls your webhook endpoint:

```bash
curl -X POST http://localhost:3000/api/webhook/job-completed \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "ABC Plumbing",
    "customerName": "Jane Doe",
    "customerEmail": "jane@example.com",
    "customerPhone": "+1555123456",
    "jobCompletedAt": "2024-07-05T14:30:00Z",
    "webhookSecret": "abc123def456..."
  }'
```

Response:
```json
{
  "success": true,
  "requestId": 42,
  "message": "Review request scheduled to be sent in 3 hours"
}
```

### 4. Set Up Background Job Trigger

The system needs to send review requests at scheduled times. You have two options:

#### Option A: Vercel Crons (Easiest - Vercel only)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/jobs/send-review-requests",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Then deploy to Vercel - crons run automatically.

#### Option B: External Cron Service (Railway, AWS Lambda, etc.)

Call the endpoint periodically:

```bash
# Every 5 minutes
curl -X POST https://yourdomain.com/api/jobs/send-review-requests \
  -H "Authorization: Bearer YOUR_REVIEW_JOB_API_KEY"
```

Popular options:
- [EasyCron](https://www.easycron.com) - Free tier
- [cron-job.org](https://cron-job.org) - Free tier
- AWS Lambda + EventBridge
- GitHub Actions scheduled workflow

### 5. Integrate with Your Service Platform

Most platforms support webhooks. Configure:

- **Webhook URL**: `https://yourdomain.com/api/webhook/job-completed`
- **Event**: "Job Completed" or "Service Completed"
- **Payload Fields**: businessName, customerName, customerEmail, customerPhone, jobCompletedAt
- **Headers**: Add `webhookSecret` from step 2

Examples:
- **HubSpot**: Workflows → Send webhook on deal close
- **Zapier**: Trigger on event → POST webhook
- **ServiceTitan**: Integrations → Custom webhooks

## Deployment to Vercel

### Quick Start

```bash
# 1. Push to GitHub
git add .
git commit -m "Add review automation system"
git push origin main

# 2. Import on Vercel
# https://vercel.com/new
# - Select your GitHub repo
# - Add environment variables from .env.local
# - Deploy

# 3. Enable Crons (optional)
# Settings → Cron Jobs → Enable
```

### Environment Variables on Vercel

1. Go to Project Settings → Environment Variables
2. Add each variable from `.env.local`:
   - DATABASE_URL
   - DIRECT_URL
   - RESEND_API_KEY
   - TWILIO_ACCOUNT_SID (if using SMS)
   - ADMIN_API_KEY
   - REVIEW_JOB_API_KEY
   - NEXTAUTH_URL (set to your Vercel domain)

## API Reference

### Webhook: Job Completed

**POST** `/api/webhook/job-completed`

```json
{
  "businessName": "string",
  "customerName": "string",
  "customerEmail": "string (optional)",
  "customerPhone": "string (optional)",
  "jobCompletedAt": "ISO 8601 timestamp",
  "webhookSecret": "string"
}
```

### Public Rating Form

**GET** `/rate/[requestId]`

Opens a simple 1-5 star rating form for customers.

**POST** `/api/rate/[requestId]`

```json
{
  "rating": 1-5,
  "feedbackText": "string (optional)"
}
```

### Background Job: Send Review Requests

**POST** `/api/jobs/send-review-requests`

**Headers**: `Authorization: Bearer YOUR_REVIEW_JOB_API_KEY`

Called periodically to send pending review requests.

### Admin: Manage Clients

**GET** `/api/admin/clients`  
List all clients

**POST** `/api/admin/clients`  
Create new client

**GET** `/api/admin/clients/[clientId]`  
Get client details and stats

**PUT** `/api/admin/clients/[clientId]`  
Update client configuration

**DELETE** `/api/admin/clients/[clientId]`  
Disable client

**GET** `/api/admin/analytics`  
Overall system analytics

## Message Template Variables

When creating/updating clients, use these template variables:

- `{link}` - Full rating form URL
- `{customerName}` - Customer's name
- `{businessName}` - Business name

Example:

```
Hi {customerName},

Thank you for choosing {businessName}! We'd love your feedback.

Click here to rate your experience: {link}

Best regards,
{businessName} Team
```

## Airtable Integration (Optional)

To log all reviews to Airtable:

1. Create a new table called "Reviews"
2. Add columns:
   - Request ID (text)
   - Customer Name (text)
   - Customer Email (text)
   - Customer Phone (text)
   - Job Completed (date)
   - Rating (number)
   - Feedback (text)
   - Feedback Type (single select: "Public Review", "Private Feedback")
   - Redirect URL (text)
   - Responded At (date)
   - Created At (date)

3. Get your API key from: https://airtable.com/account/tokens
4. Get your Base ID from the URL: https://airtable.com/[BASE_ID]/...
5. Add to client configuration

## Pricing (for a business)

- **Database**: Supabase free tier (up to 500MB)
- **Email**: Resend free tier ($20/month after 100 emails)
- **SMS**: Twilio - $0.0075 per SMS
- **Hosting**: Vercel free tier (up to 100GB bandwidth)
- **Airtable**: Free tier (1,200 records)

**Estimated monthly cost**: $0-50 depending on volume

## Support & Customization

This is a base implementation. Common customizations:

- **SMS-only delivery**: Remove email, keep SMS
- **Google Sheets instead of Airtable**: Use Google Sheets API
- **Custom rating form styling**: Modify `/app/rate/[requestId]/page.tsx`
- **WhatsApp delivery**: Replace Twilio with WhatsApp Business API
- **Advanced analytics dashboard**: Build dashboard against API

## Troubleshooting

### Reviews not being sent
1. Check that cron job is enabled/running
2. Verify background job has correct API key in Authorization header
3. Check database for pending reviews: `SELECT * FROM ReviewRequest WHERE sent = false`
4. Check Resend/Twilio logs for delivery failures

### Customer not receiving rating link
1. Check email ended up in spam
2. For SMS, verify phone number format includes country code (e.g., +1)
3. Check Twilio trial credits haven't expired

### Rating form showing "Review request not found"
- Ensure you're using the correct `requestId` from webhook response
- Database might not have record yet (check replication)

## Security Considerations

- **Webhook signatures**: All incoming webhooks verify the secret
- **Admin API key**: Protect `ADMIN_API_KEY` - only provide to trusted admins
- **Background job key**: Protect `REVIEW_JOB_API_KEY` - only cron can call
- **Airtable keys**: Consider using environment-specific tokens with limited scope
- **CORS**: Configure for your specific domain, not wildcard

## Next Steps

1. Create your first client via admin API
2. Set up test webhook to verify flow
3. Deploy to Vercel
4. Connect your service scheduling platform
5. Monitor analytics dashboard

---

**Questions?** Email support@yourservice.com or check GitHub issues.
