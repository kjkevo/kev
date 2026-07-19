# Deployment Checklist - Do This Now

Follow these steps in order. Each takes 5-10 minutes.

## ✅ Step 1: Create Twilio Account (5 minutes)

**What you need:** An email address

**Do this:**
1. Go to https://www.twilio.com/console
2. Click **Sign Up** (top right)
3. Enter your email and password
4. Verify your email
5. Create account

**Result:** You'll have a Twilio account with $15 free trial credit

---

## ✅ Step 2: Buy a Twilio Phone Number (5 minutes)

**What you need:** Nothing yet

**Do this:**
1. In Twilio Console, click **Phone Numbers** (left menu)
2. Click **Buy a Number**
3. Select your country (e.g., United States)
4. Choose area code for your service area
5. Search and select a number
6. Click **Buy** (costs $1.15/month)
7. Confirm purchase

**Result:** You now own a phone number for your business

**Screenshot where to find this:**
```
Twilio Console
├── Phone Numbers (left sidebar)
└── Buy a Number (button)
```

---

## ✅ Step 3: Get Your Twilio Credentials (2 minutes)

**What you need:** Your Twilio account

**Do this:**
1. In Twilio Console, go to **Account** (top left dropdown)
2. Click **Account Settings**
3. You'll see:
   - **Account SID** (looks like: ACxxxxxxxxxxxxx)
   - **Auth Token** (long random string)
4. Copy both and save them somewhere (Google Doc, text file, etc.)

**Also save:**
- Your Twilio phone number from Step 2 (e.g., +15551234567)

**⚠️ KEEP THESE SECRET** - Never share your Auth Token

**Save these in a safe place:**
```
TWILIO_ACCOUNT_SID: AC[...]
TWILIO_AUTH_TOKEN: [...]
TWILIO_PHONE_NUMBER: +1[...]
```

---

## ✅ Step 4: Deploy to Vercel (10 minutes)

**What you need:** Your GitHub account, the 3 Twilio values from Step 3

**Do this:**

1. Go to https://vercel.com
2. Click **Sign Up**
3. Choose **GitHub** (sign in with your GitHub account)
4. Authorize Vercel to access your repos
5. After login, click **Add New** → **Project**
6. Find and select `kjkevo/kev` repository
7. Click **Import**

**Next screen - Environment Variables:**
8. Click **Environment Variables**
9. Add these variables (copy from Step 3):

```
TWILIO_ACCOUNT_SID = AC[your value]
TWILIO_AUTH_TOKEN = [your value]
TWILIO_PHONE_NUMBER = +1[your number]
BUSINESS_NAME = Your Business Name
BUSINESS_OWNER_PHONE = +1234567890 (your phone)
BUSINESS_OWNER_EMAIL = your@email.com
NEXTAUTH_SECRET = (generate random string - click the refresh icon)
NEXTAUTH_URL = (leave blank, will fill after deployment)
```

10. Scroll down and click **Deploy**
11. **Wait 2-3 minutes** for deployment to complete
12. You'll see a green checkmark ✅

**After deployment:**
13. Click the domain link (e.g., `kev-business.vercel.app`)
14. You should see the app load
15. **Copy your domain** - you'll need it in Step 5

**Your domain looks like:** `https://[something].vercel.app`

---

## ✅ Step 5: Configure Twilio Webhooks (10 minutes)

**What you need:** Your Vercel domain from Step 4

**Do this:**

1. Go back to **Twilio Console**
2. Click **Phone Numbers** (left menu)
3. Click **Manage Numbers**
4. Select the number you bought in Step 2

**Configure Voice:**
5. Scroll to **Voice & Fax**
6. Under "A Call Comes In":
   - Select "Webhook"
   - URL: `https://[your-domain].vercel.app/api/webhooks/twilio/incoming-call`
7. Under "Call Status Changes":
   - Select "Webhook"  
   - URL: `https://[your-domain].vercel.app/api/webhooks/twilio/call-status`

**Configure Messaging:**
8. Scroll to **Messaging**
9. Under "A Message Comes In":
   - Select "Webhook"
   - URL: `https://[your-domain].vercel.app/api/webhooks/twilio/sms-inbound`

10. Click **Save**

**Replace [your-domain] with actual domain from Step 4**

Example:
```
https://kev-business.vercel.app/api/webhooks/twilio/incoming-call
```

---

## ✅ Step 6: Verify Deployment (2 minutes)

**Do this:**
1. Open your browser
2. Go to: `https://[your-domain].vercel.app/api/health`
3. You should see:
```json
{
  "status": "ok",
  "timestamp": "2026-07-19T...",
  "version": "1.0.0"
}
```

**If you see this, everything is deployed correctly! ✅**

---

## ✅ Step 7: Test with Real Call (5 minutes)

**What you need:** Your phone

**Do this:**

1. From your personal phone (NOT your business phone yet)
2. Call your Twilio number (the one from Step 2)
3. You'll hear: "Thank you for calling. We're not available right now..."
4. Don't answer on your business phone
5. Hang up
6. **Wait 10 seconds**
7. **Check your personal phone for SMS**

**You should receive:**
```
Sorry we missed your call! Your Business Name will call you back 
shortly. Reply here if you'd like to send details now.
```

**If you get this SMS, YOU'RE DONE! 🎉**

---

## ✅ Troubleshooting

### "Can't see the SMS"
- Make sure you waited 10 seconds after hanging up
- Check spam folder
- Verify Twilio account has credits (shows in dashboard)
- Check your phone number format is correct (+1234567890)

### "Webhook error in Twilio"
- Verify URL is HTTPS (not HTTP)
- Check there are no typos in domain
- Try opening URL in browser - should see error or JSON

### "Deployment failed"
- Check Vercel logs (Deployments tab)
- Make sure all environment variables are set
- Contact Vercel support if stuck

### "Can't hear the greeting"
- Check voice URL is correct in Twilio
- Call from different number
- Check Twilio account settings

---

## 🎉 Success Criteria

You'll know it's working when:

- ✅ You can call your Twilio number
- ✅ You hear a greeting
- ✅ After hanging up, you get an SMS
- ✅ SMS arrives within 10 seconds
- ✅ SMS is from your Twilio number

**Once all these work, you're live with real customers!**

---

## 📝 Save Your Credentials

Keep this somewhere safe for reference:

```
TWILIO_ACCOUNT_SID: AC...
TWILIO_AUTH_TOKEN: ...
TWILIO_PHONE_NUMBER: +1...
VERCEL_DOMAIN: https://...vercel.app
BUSINESS_EMAIL: ...@gmail.com
```

---

## 🚀 What's Next After Testing

1. **Add your business info**
   - Update BUSINESS_NAME in Vercel env vars
   - Update BUSINESS_OWNER_EMAIL and PHONE

2. **Set up email alerts** (optional)
   - Add Gmail app password
   - Configure EMAIL_USER and EMAIL_PASSWORD in Vercel

3. **Set up Airtable** (optional)
   - Log into Airtable
   - Create base and tables
   - Add AIRTABLE_* credentials to Vercel

4. **Go live**
   - Update your business phone number to route to Twilio
   - Start receiving automatic SMS for missed calls

---

**Questions? Check SETUP.md or README.md for more details.**

**Ready? Start with Step 1 now!**
