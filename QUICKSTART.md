# Quick Start Guide - Review Reputation Automation

Get up and running in 5 minutes.

## Step 1: Prerequisites

Gather these before starting:
- Database URL from Supabase/Railway/etc
- Resend API key (free at resend.com)
- (Optional) Twilio credentials for SMS
- (Optional) Airtable base ID and API key

## Step 2: Set Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your values:
```env
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
NEXTAUTH_URL=https://yourdomain.com
RESEND_API_KEY=re_xxx
ADMIN_API_KEY=super-secret-admin-key
REVIEW_JOB_API_KEY=super-secret-job-key
```

Generate secure keys:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 3: Database Migration

```bash
npm run db:migrate
```

This creates the review tables.

## Step 4: Create Your First Client

```bash
ADMIN_KEY="super-secret-admin-key"

curl -X POST http://localhost:3000/api/admin/clients \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC Plumbing",
    "businessEmail": "owner@abcplumbing.com",
    "contactName": "John Smith",
    "delayHours": 3,
    "messageTemplate": "Hi {customerName}, thanks for your business! Rate us: {link}",
    "googleReviewUrl": "https://g.page/abcplumbing"
  }'
```

Save the `webhookSecret` from the response.

## Step 5: Test the Webhook

```bash
WEBHOOK_SECRET="abc123..." # from step 4
curl -X POST http://localhost:3000/api/webhook/job-completed \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "ABC Plumbing",
    "customerName": "Jane Doe",
    "customerEmail": "jane@example.com",
    "customerPhone": "+15551234567",
    "jobCompletedAt": "2024-07-05T14:30:00Z",
    "webhookSecret": "'$WEBHOOK_SECRET'"
  }'
```

You should get:
```json
{
  "success": true,
  "requestId": 1,
  "message": "Review request scheduled to be sent in 3 hours"
}
```

## Step 6: Test the Rating Form

Open in your browser:
```
http://localhost:3000/rate/1
```

You should see a 5-star rating form. Submit a test rating.

## Step 7: Deploy to Vercel

```bash
npm run build
git add .
git commit -m "Add review reputation automation"
git push origin main
```

Then:
1. Go to https://vercel.com/new
2. Import your GitHub repo
3. Add environment variables
4. Deploy

Your app is now live at `https://your-project.vercel.app`

## Step 8: Set Up Your Platform Integration

Follow the integration guide in `INTEGRATION_EXAMPLES.md` to connect:
- ServiceTitan
- Jobber
- Zapier
- Your custom platform

## Step 9: Monitor

View analytics:
```bash
curl -H "Authorization: Bearer super-secret-admin-key" \
  https://yourdomain.com/api/admin/analytics
```

---

## Common Issues

### "Email service not configured"
→ Ensure `RESEND_API_KEY` is set in environment

### "Database not found"
→ Run `npm run db:migrate`

### Webhook returns 404
→ Verify app is deployed and URL is correct

### Ratings not sending
→ Check cron job is running (Vercel dashboard → Crons)

---

## Next Steps

1. **Read full setup**: See `REVIEW_REPUTATION_README.md` for detailed docs
2. **View integrations**: See `INTEGRATION_EXAMPLES.md` for platform setups
3. **Advanced config**: Customize message templates, review links, delays
4. **Scale up**: Add SMS, Airtable logging, team management

---

**Need help?** Check the troubleshooting section in the main README.
