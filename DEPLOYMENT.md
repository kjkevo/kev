# Deployment Guide - Missed Call Text-Back Automation

Complete guide to deploying the system to production on Vercel.

## Prerequisites Checklist

- [ ] Twilio account with credentials (Account SID, Auth Token, Phone Number)
- [ ] Supabase PostgreSQL database configured
- [ ] Airtable account (optional for analytics)
- [ ] Gmail account with App Password enabled (for email alerts)
- [ ] Vercel account created
- [ ] GitHub repository access
- [ ] Domain name (optional, Vercel provides default)

---

## Deployment Steps

### 1. Prepare Environment Variables

Create a secure `.env.local` file with all required variables:

```bash
# Database (from Supabase)
DATABASE_URL="postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres"

# Twilio
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="auth_token_here"
TWILIO_PHONE_NUMBER="+1234567890"

# Business Config
BUSINESS_NAME="Your Service Business"
BUSINESS_OWNER_PHONE="+1234567890"
BUSINESS_OWNER_EMAIL="owner@yourbusiness.com"

# Email (Gmail with App Password)
EMAIL_SERVICE="gmail"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASSWORD="xxxx xxxx xxxx xxxx"  # 16-char App Password

# Message Templates
MISSED_CALL_MESSAGE="Sorry we missed your call! {BUSINESS_NAME} will call you back shortly. Reply here if you'd like to send details now."
LEAD_SUBMISSION_MESSAGE="Hi {NAME}! Thanks for reaching out to {BUSINESS_NAME}. We got your message and will reply shortly."

# Airtable (optional)
AIRTABLE_API_KEY="key..."
AIRTABLE_BASE_ID="app..."
AIRTABLE_MISSED_CALLS_TABLE_ID="tbl..."
AIRTABLE_LEADS_TABLE_ID="tbl..."

# NextAuth (required for dashboard)
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="https://your-app.vercel.app"
```

### 2. Run Database Migration

Ensure your database schema is up to date:

```bash
# Locally first
npm install
npm run db:migrate

# This creates:
# - BusinessConfig table
# - MissedCall table
# - LeadSubmission table
```

Verify migration succeeded:
```bash
npm run db:studio
# Should show the 3 new tables
```

### 3. Link to Vercel

Option A: Via CLI
```bash
npm install -g vercel
vercel login
vercel link
```

Option B: Via Web
1. Go to [vercel.com](https://vercel.com)
2. Connect GitHub
3. Import project
4. Select `kjkevo/kev` repository
5. Select branch `claude/missed-call-textback-6a4nxe`

### 4. Configure Environment Variables in Vercel

1. In Vercel dashboard → Settings → Environment Variables
2. Add each variable from your `.env.local`:
   - Name: `TWILIO_ACCOUNT_SID`, Value: `AC...`
   - Name: `TWILIO_AUTH_TOKEN`, Value: `...`
   - Name: `TWILIO_PHONE_NUMBER`, Value: `+1...`
   - etc.

3. **Important:** Set environment availability to **Production**

### 5. Deploy

Option A: Automatic (Recommended)
```bash
git push origin claude/missed-call-textback-6a4nxe
# Vercel automatically deploys on push
```

Option B: Manual
```bash
vercel deploy --prod
```

Wait for deployment to complete. You'll get a URL like:
```
https://missed-call-textback-6a4nxe.vercel.app
```

### 6. Verify Deployment

```bash
# Test health endpoint
curl https://your-app.vercel.app/api/health

# Should return:
# {"status":"ok","timestamp":"...","version":"1.0.0"}
```

Check Vercel logs:
```bash
vercel logs --project your-project-name --follow
```

### 7. Configure Twilio Webhooks

Now point Twilio to your live deployment:

1. Go to [Twilio Console](https://console.twilio.com/)
2. Phone Numbers → Manage Numbers → Select your number
3. Voice & Fax Configuration:
   - **A Call Comes In**: Webhook → `https://your-app.vercel.app/api/webhooks/twilio/incoming-call`
   - **Call Status Changes**: Webhook → `https://your-app.vercel.app/api/webhooks/twilio/call-status`
4. Click "Save"

### 8. Add Initial Business Config

Add your business to the database:

```bash
# Using Prisma Studio
npm run db:studio

# Or via Node.js
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.businessConfig.create({
  data: {
    businessName: 'ABC Plumbing',
    businessPhone: '+1234567890',
    ownerPhone: '+1987654321',
    ownerEmail: 'owner@abcplumbing.com',
    airtableApiKey: 'key...',
    airtableBaseId: 'app...',
    airtableMissedTable: 'tbl...',
    airtableLeadsTable: 'tbl...'
  }
}).then(console.log).catch(console.error).finally(() => prisma.\$disconnect());
"
```

### 9. Test End-to-End

```bash
# Test 1: Health check
curl https://your-app.vercel.app/api/health

# Test 2: Missed call simulation
curl -X POST https://your-app.vercel.app/api/webhooks/twilio/call-status \
  -d "CallStatus=no-answer&From=%2B15551234567&CallSid=CA123&CallDuration=5"

# Test 3: Lead submission
curl -X POST https://your-app.vercel.app/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","phone":"+15551234567","serviceRequested":"Test"}'

# Expected:
# - You receive SMS at your Twilio number
# - You receive email alert
# - Records appear in database/Airtable
```

### 10. Monitor Production

Set up Vercel monitoring:

1. **Real-time Logs**
   ```bash
   vercel logs --project your-project-name --follow
   ```

2. **Error Notifications**
   - Vercel Settings → Notifications → Enable
   - Get alerted on deployment failures

3. **Database Monitoring**
   - Check Supabase dashboard for query errors
   - Monitor connection pool usage

4. **Twilio Logs**
   - Twilio Console → Logs → Debugger
   - Monitor incoming/outgoing messages

---

## Post-Deployment Checklist

- [ ] Health endpoint responds
- [ ] Twilio webhooks configured
- [ ] Lead submission webhook tested
- [ ] Missed call SMS sent and logged
- [ ] Owner email alerts received
- [ ] Airtable records created (if configured)
- [ ] Database records visible in Prisma Studio
- [ ] Vercel logs clean (no errors)
- [ ] Twilio logs show incoming calls
- [ ] Custom domain configured (if needed)

---

## Scaling Considerations

### Load Testing
For production readiness with high volume:

```bash
# Test with 100 concurrent requests
ab -n 100 -c 10 \
  https://your-app.vercel.app/api/webhooks/lead-submission

# Use k6 for realistic load test
npm install -g k6
k6 run load-test.js
```

### Database Optimization
If handling 1000+ calls/month:

```sql
-- Add indexes for faster queries
CREATE INDEX idx_missed_call_phone ON "MissedCall"("callerPhone");
CREATE INDEX idx_lead_phone ON "LeadSubmission"("phone");
CREATE INDEX idx_business_id ON "MissedCall"("businessId");
```

### Caching
For high-traffic deployments, add caching:

```typescript
// In lib/config.ts - add Redis caching
const cachedConfig = await redis.get(`business-${businessId}`);
if (cachedConfig) return JSON.parse(cachedConfig);
```

### Rate Limiting
Protect against abuse:

```bash
npm install express-rate-limit

# Then use in API routes
```

---

## Rollback Instructions

If something goes wrong after deployment:

### Option 1: Revert to Previous Deployment
```bash
vercel deployments list
vercel rollback <deployment-id>
```

### Option 2: Manual Rollback
```bash
git revert HEAD
git push origin claude/missed-call-textback-6a4nxe
# Vercel redeploys automatically
```

### Option 3: Emergency Disable
Disable webhooks in Twilio until fixed:
1. Twilio Console → Phone Numbers
2. Set "A Call Comes In" to "Do nothing"
3. Disable "Call Status Changes"

---

## Cost Monitoring

Monitor monthly costs:

| Service | Alert Threshold |
|---------|-----------------|
| Twilio SMS | $50/month |
| Vercel | $50/month |
| Supabase | $25/month |
| Total | $125/month |

Set billing alerts in:
- Twilio dashboard
- Vercel dashboard
- Supabase dashboard

---

## Performance Optimization

### Cold Start Time
Next.js serverless cold starts ~1-2s. Acceptable for webhooks.

### Database Connection
Supabase PgBouncer handles connection pooling automatically.

### API Response Time
- Incoming call: <500ms
- Call status: <1s
- Lead submission: <1.5s

Monitor in Vercel Analytics dashboard.

---

## Troubleshooting Deployment

### 500 Error on Deploy
```bash
vercel logs --project your-project-name
# Check for environment variable issues
# Verify DATABASE_URL is in production
```

### Webhooks Not Firing
1. Verify Twilio URLs are correct
2. Test with `curl` from command line
3. Check Vercel logs for errors
4. Verify environment variables loaded

### Database Connection Issues
```bash
# Test from local machine
psql $DATABASE_URL -c "SELECT NOW();"

# If fails: verify DATABASE_URL in Vercel
```

### SMS Not Sending
1. Check Twilio account balance
2. Verify TWILIO_ACCOUNT_SID and AUTH_TOKEN
3. Check phone numbers in E.164 format
4. Review Twilio error logs

---

## Next: Multi-Client Deployment

Once working for one business, scale to multiple:

1. Create new BusinessConfig via Prisma Studio
2. Pass `businessId` in webhook requests
3. Each client uses their own Twilio number OR
4. Each client gets separate webhook URL:
   - `https://your-app.vercel.app/api/webhooks/lead-submission?businessId=1`
   - `https://your-app.vercel.app/api/webhooks/lead-submission?businessId=2`

---

## Maintenance

### Regular Tasks
- **Weekly**: Check Vercel logs for errors
- **Weekly**: Monitor Twilio logs
- **Monthly**: Review Airtable analytics
- **Monthly**: Check database storage usage
- **Quarterly**: Update dependencies (`npm update`)

### Backup Strategy
- Supabase automated backups (daily)
- Export Airtable data monthly
- Keep git history (GitHub acts as backup)

---

**Status:** Ready for Production  
**Recommended:** Start with 1 customer, scale to 10+ gradually  
**Support:** Check TESTING.md for comprehensive test scenarios
