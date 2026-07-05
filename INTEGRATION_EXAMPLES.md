# Integration Examples

This guide shows how to integrate the Review Reputation system with popular service platforms.

## Webhook Format

All platforms should POST to: `https://yourdomain.com/api/webhook/job-completed`

**Required JSON payload:**
```json
{
  "businessName": "ABC Plumbing",
  "customerName": "Jane Doe",
  "customerEmail": "jane@example.com",
  "customerPhone": "+1555123456",
  "jobCompletedAt": "2024-07-05T14:30:00Z",
  "webhookSecret": "your-webhook-secret-from-admin"
}
```

---

## Platform-Specific Integration

### ServiceTitan

ServiceTitan users can set up a custom integration:

1. **Admin Dashboard** → **Settings** → **Integrations** → **Webhooks**
2. **Create Webhook**
   - Name: "Review Request Automation"
   - Event: "Job Completed"
   - Webhook URL: `https://yourdomain.com/api/webhook/job-completed`
   - Method: POST
   - Headers: None (unless you want to add auth)

3. **Map Fields**
   - serviceTitan.business.name → `businessName`
   - serviceTitan.customer.name → `customerName`
   - serviceTitan.customer.email → `customerEmail`
   - serviceTitan.customer.phone → `customerPhone`
   - serviceTitan.job.completedAt → `jobCompletedAt` (ISO format)

**ServiceTitan Workflow Example:**
```
Job Completed 
→ Trigger Webhook to Review System
→ After 3 hours, customer gets rating request
→ Rating logged to ServiceTitan notes (optional)
```

---

### Zapier

**Zap Setup:**

1. **Trigger**: "New Job Completed" (ServiceTitan, Jobber, Housecall Pro, etc.)
2. **Action**: "POST to URL"
   - URL: `https://yourdomain.com/api/webhook/job-completed`
   - Data:
     ```
     businessName: {{business.name}}
     customerName: {{customer.name}}
     customerEmail: {{customer.email}}
     customerPhone: {{customer.phone}}
     jobCompletedAt: {{job.completed_at}}
     webhookSecret: {{your-webhook-secret}}
     ```

**Example Zap Recipe:**
- **Trigger**: Jobber → New Job Completed
- **Filter**: Status = "Complete"
- **Action**: Webhooks by Zapier → POST

---

### Make (formerly Integromat)

**Scenario Setup:**

1. **Trigger Module**: Your service app (ServiceTitan, Jobber, etc.)
   - Watch for: Job Completed event

2. **Action Module**: HTTP Request
   - URL: `https://yourdomain.com/api/webhook/job-completed`
   - Method: POST
   - Body type: JSON
   - Content:
     ```json
     {
       "businessName": "{{service_app.business_name}}",
       "customerName": "{{service_app.customer_name}}",
       "customerEmail": "{{service_app.customer_email}}",
       "customerPhone": "{{service_app.customer_phone}}",
       "jobCompletedAt": "{{service_app.job_completed_at}}",
       "webhookSecret": "{{variable.webhook_secret}}"
     }
     ```

---

### Native Integrations

#### Jobber

Jobber has native Zapier/Make integration, or custom webhooks via:

**Jobber Admin** → **Settings** → **Connected Services** → **Developer**

```
POST /api/webhook/job-completed
Content-Type: application/json

{
  "businessName": "{{ jobber.client.businessName }}",
  "customerName": "{{ jobber.customer.name }}",
  "customerEmail": "{{ jobber.customer.email }}",
  "customerPhone": "{{ jobber.customer.phone }}",
  "jobCompletedAt": "{{ jobber.job.endTime }}",
  "webhookSecret": "your-secret"
}
```

#### HubSpot

For HubSpot CRM, use **Workflows**:

1. **Create Workflow**
   - Trigger: Deal closed (won)
   - Action: Send webhook
   - URL: `https://yourdomain.com/api/webhook/job-completed`
   - Payload:
     ```
     businessName: Company Name
     customerName: Contact Name
     customerEmail: Contact Email
     customerPhone: Contact Phone Number
     jobCompletedAt: Deal Close Date
     webhookSecret: your-secret
     ```

#### Stripe (for service payments)

If you process payments via Stripe:

```javascript
// In your backend after successful payment
await fetch('https://yourdomain.com/api/webhook/job-completed', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    businessName: businessName,
    customerName: paymentIntent.metadata.customer_name,
    customerEmail: paymentIntent.receipt_email,
    customerPhone: paymentIntent.metadata.customer_phone,
    jobCompletedAt: new Date().toISOString(),
    webhookSecret: process.env.WEBHOOK_SECRET,
  }),
});
```

---

## Testing Your Integration

### 1. Test Webhook Manually

```bash
curl -X POST https://yourdomain.com/api/webhook/job-completed \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "ABC Plumbing",
    "customerName": "Test Customer",
    "customerEmail": "test@example.com",
    "customerPhone": "+15551234567",
    "jobCompletedAt": "2024-07-05T14:30:00Z",
    "webhookSecret": "your-webhook-secret"
  }'
```

Expected response:
```json
{
  "success": true,
  "requestId": 42,
  "message": "Review request scheduled to be sent in 3 hours"
}
```

### 2. Monitor Pending Requests

Check your database or API:

```bash
# Get analytics
curl -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  https://yourdomain.com/api/admin/analytics
```

### 3. Test Email Delivery

1. Trigger a test webhook
2. Wait for email (or check Resend dashboard)
3. Click rating link
4. Submit a test rating

---

## Troubleshooting Integration

### Webhook fails with 404
- Verify URL is correct: `https://yourdomain.com/api/webhook/job-completed`
- Check that your app is deployed to Vercel

### Webhook fails with 401 (Unauthorized)
- Verify `webhookSecret` matches what's in admin dashboard
- Check that secret is exactly correct (case-sensitive)

### "Business not found"
- Verify business name exactly matches what's in admin
- Business must be enabled in admin dashboard
- Check: `GET /api/admin/clients` with admin API key

### Emails not sending
- Verify Resend API key is set
- Check Resend dashboard for bounced emails
- Ensure `RESEND_FROM_EMAIL` is verified in Resend
- Check email spam folder

### SMS not sending (if using Twilio)
- Verify Twilio credentials
- Ensure phone number includes country code (+1, etc.)
- Check Twilio trial credits haven't expired

---

## Rate Limiting & Throttling

The system is designed to handle high volume:
- Background job runs every 5 minutes
- Sends emails in batches
- Respects platform rate limits

For very high volume (>1000 requests/day):
1. Increase cron frequency: `*/2 * * * *` (every 2 minutes)
2. Use Airtable for analytics instead of polling
3. Consider adding a message queue (Vercel's built-in works fine for most cases)

---

## Advanced: Custom Platform Integration

If your platform isn't listed, use their webhook/automation features to POST to the webhook endpoint with the required JSON payload.

**Generic template:**
```json
{
  "businessName": "{{business_name}}",
  "customerName": "{{customer_name}}",
  "customerEmail": "{{customer_email}}",
  "customerPhone": "{{customer_phone}}",
  "jobCompletedAt": "{{job_completed_timestamp}}",
  "webhookSecret": "{{env.WEBHOOK_SECRET}}"
}
```

Most platforms support:
- Zapier (universal automation platform)
- Make/Integromat (workflow automation)
- n8n (self-hosted automation)
- Custom REST API calls

---

## Next Steps

1. Choose your platform from above
2. Set up the integration
3. Test with a sample webhook
4. Deploy to production
5. Monitor analytics dashboard

Need help? Check the main README.md or review your platform's webhook documentation.
