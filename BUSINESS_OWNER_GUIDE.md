# Business Owner's Quick Start Guide

Welcome! This system automatically texts your customers when they miss your call. Get started in 45 minutes.

## What You're Getting

✅ **Automatic SMS to Missed Callers** - "We missed your call, we'll call back"  
✅ **Email Alerts to You** - Know when new leads come in  
✅ **Professional Voicemail** - Auto-greet callers with a message  
✅ **Call & Lead Tracking** - See all activity in database + Airtable  
✅ **Free Setup** - Uses free/low-cost services

## How It Works (30 seconds)

```
Customer calls → You don't answer → Customer gets automatic SMS → You get email alert
```

That's it! Everything happens automatically.

## Timeline

| Step | Time | Action |
|------|------|--------|
| 1 | 5 min | Create Twilio account & buy phone number |
| 2 | 5 min | Get Twilio credentials |
| 3 | 10 min | Set up Airtable (optional but recommended) |
| 4 | 10 min | Deploy to Vercel |
| 5 | 10 min | Configure Twilio webhooks |
| 6 | 5 min | Test with a real call |

**Total: ~45 minutes**

## Step 1: Create Twilio Account (5 minutes)

1. Go to [twilio.com](https://twilio.com)
2. Sign up (free trial gives you $15 credit)
3. Go to Console → Phone Numbers → Buy a Number
4. Choose your area code (e.g., your local area)
5. Pay $1.15/month for the number

**That's it!** You now have your business phone number.

## Step 2: Get Your Credentials (5 minutes)

In Twilio Console:
- Note your **Account SID** (on dashboard, looks like `AC...`)
- Note your **Auth Token** (on dashboard, looks like long string)
- Note your **Phone Number** (the one you just bought)

**Save these somewhere safe** — you'll need them soon.

## Step 3: Set Up Airtable (10 minutes, OPTIONAL)

Airtable is a spreadsheet where all your calls get logged. Great for tracking trends.

1. Go to [airtable.com](https://airtable.com)
2. Create account and new base called "Business"
3. Create 2 tables:
   - **Missed Calls** - Track missed calls
   - **Leads** - Track new leads
4. Get your API key from [airtable.com/account](https://airtable.com/account)
5. Note your Base ID and Table IDs

**Skip this if you just want the SMS feature.**

## Step 4: Deploy to Vercel (10 minutes)

Vercel hosts your system for free.

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click "Add New" → "Project"
4. Select this repository (`kjkevo/kev`)
5. Add environment variables (Step 6)
6. Click Deploy
7. Wait ~2 minutes for deployment to complete
8. Note your domain (e.g., `business-calls.vercel.app`)

## Step 5: Configure Twilio Webhooks (10 minutes)

Tell Twilio where to send call information.

1. Go back to Twilio Console
2. Phone Numbers → Active Numbers → Your Number
3. Under **Voice Configuration**:
   - "A Call Comes In": Set to `https://your-domain.vercel.app/api/webhooks/twilio/incoming-call`
   - "Call Status Changes": Set to `https://your-domain.vercel.app/api/webhooks/twilio/call-status`
4. Under **Messaging Configuration**:
   - "A Message Comes In": Set to `https://your-domain.vercel.app/api/webhooks/twilio/sms-inbound`
5. Save

(Use the domain from Step 4)

## Step 6: Add Environment Variables (5 minutes)

Back in Vercel, go to Project Settings → Environment Variables and add:

```
# From Twilio (Step 2)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890

# Your business info
BUSINESS_NAME=Your Business Name
BUSINESS_OWNER_PHONE=+1234567890
BUSINESS_OWNER_EMAIL=your@email.com

# Optional: Gmail for email alerts
EMAIL_USER=your@gmail.com
EMAIL_PASSWORD=your-app-password

# Optional: Airtable (Step 3)
AIRTABLE_API_KEY=...
AIRTABLE_BASE_ID=...
AIRTABLE_MISSED_CALLS_TABLE_ID=...
AIRTABLE_LEADS_TABLE_ID=...

# Keep these (for other features)
NEXTAUTH_SECRET=generate-random-string
NEXTAUTH_URL=https://your-domain.vercel.app
```

Redeploy after adding variables.

## Step 7: Test It! (5 minutes)

1. Call your Twilio number from your phone
2. Don't answer (let it ring or go to voicemail)
3. Hang up
4. **Within 10 seconds, you should get an SMS**
5. Check your email for alert

**If it works, you're done! 🎉**

## Costs

### Free/Cheap Tier (Most Businesses)

- **Twilio**: $1.15/month for number + ~$0.0075 per SMS
  - 100 calls/month = ~$1 in SMS costs
  - 1000 calls/month = ~$10 in SMS costs
- **Vercel**: Free (hosting)
- **Supabase**: Free (database)
- **Airtable**: Free (logging)
- **Total**: ~$1-50/month depending on call volume

### What If You Get Busy?

- 500+ calls/month: Consider Twilio paid tier for bulk SMS discounts
- Upgrade Supabase if database grows (free tier = 500MB)

## Common Questions

**Q: Do I need Airtable?**  
A: No, everything works without it. But it's free and great for tracking trends.

**Q: What if I don't use Gmail?**  
A: Email alerts won't work (but SMS still does). You can configure other email providers.

**Q: Can I use this for multiple locations?**  
A: Yes! Create multiple Twilio numbers and business configs. Each gets its own SMS.

**Q: What happens to the voicemail?**  
A: Customers can leave messages (120 seconds max). Messages aren't stored by this system, but Twilio might record them.

**Q: How fast are SMS sent?**  
A: Usually within 5-10 seconds of the missed call.

**Q: Is my data safe?**  
A: Supabase is enterprise-grade. Phone numbers and call data are encrypted.

## Troubleshooting

**Not getting SMS?**
1. Check Twilio account has SMS credits
2. Verify phone numbers are in format: +1234567890
3. Check Vercel logs for errors

**Not getting email alerts?**
1. Make sure EMAIL_USER and EMAIL_PASSWORD are set
2. If using Gmail, use app password (not regular password)
3. Check spam folder

**Webhook errors in Twilio Console?**
1. Verify domain is correct (HTTPS, not HTTP)
2. Check Vercel logs for 500 errors
3. Make sure all environment variables are set

## Next Steps

1. ✅ System is live - start using it!
2. Monitor for a few days - check logs in Vercel
3. Track costs - Twilio may bill monthly
4. Customize messages (in Vercel environment variables)
5. Add to your website (integrate lead submission form)

## Support

**Need help?**
1. Check [SETUP.md](./SETUP.md) for detailed setup
2. Check [README.md](./README.md) for technical details
3. Check [TESTING.md](./TESTING.md) for testing guides

## Monitoring Your System

### Check System Health

```bash
curl https://your-domain.vercel.app/api/health
```

Should return "ok" - if not, something's wrong.

### View Recent Calls/Leads

**In Vercel Dashboard:**
1. Go to Deployments → Latest → Logs
2. Search for "New lead" or "Call"
3. See what's happening

**In Airtable:**
1. Open your base
2. Look at Missed Calls table
3. See timestamp, phone, SMS status

### Check Costs

**Twilio Dashboard:**
- See current month's usage
- Adjust spending limits if needed

**Vercel Dashboard:**
- See bandwidth and function calls
- Should be near-zero cost

---

**Congratulations! Your system is ready.** You're now automating customer follow-up. 🚀

Questions? Review the guides or check the dashboard logs.
