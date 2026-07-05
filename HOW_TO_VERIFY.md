# How to Know Everything is Working

A practical guide to verify the entire appointment reminder system end-to-end.

---

## Quick Answer: Run This

```bash
# Terminal 1: Start the API
npm run dev

# Terminal 2: Start the reminder service
npm run reminders:dev

# Terminal 3: Run the automated test
chmod +x test-all-features.sh
./test-all-features.sh
```

**If you see `[SMS MOCK]` messages appearing in Terminal 1, the system is working.**

---

## What to Watch For

### ✅ "The System is Working" Looks Like:

**When you create an appointment:**
```
[SMS MOCK] To: +15551234567, Message: "Hi Sarah Johnson, your appointment is confirmed for Jul 15 at 10:30 AM..."
```

**When a 24-hour reminder fires:**
```
[SMS MOCK] To: +15551234567, Message: "Hi Sarah Johnson, reminder: you have an appointment tomorrow at 10:30 AM..."
```

**When you mark no-show:**
```
[SMS MOCK] To: +15551234567, Message: "We noticed you missed your appointment. We'd love to reschedule! Call +1234567890..."
```

**When you notify the waitlist:**
```
[SMS MOCK] To: +15557777777, Message: "Hi Alice Wong, great news! We have an opening for Cleaning on Jul 20..."
```

**When second person on waitlist doesn't get messaged:**
```
No SMS to Bob Chen (this is correct!)
```

**When different client gets appointment:**
```
[SMS MOCK] To: +13125550200, Message: "Hey! Your appointment at The Hair Studio is booked for Jul 15 at 12:00 PM!..."
                                       ↑ Different business name
                                                                        ↑ Different time (same UTC, different timezone)
```

---

## The Complete Testing Flow

### 1. **Setup (5 minutes)**

```bash
npm install
cp config/clients-example.ts config/clients.ts
```

### 2. **Start Services**

```bash
# Terminal 1
npm run dev
# Should see: "✓ Ready in 2.5s" and "Local: http://localhost:3000"

# Terminal 2
npm run reminders:dev
# Should see:
# Appointment reminder service started
# 24-hour reminders: Every hour at :00
# 2-hour reminders: Every 30 minutes
```

### 3. **Run Automated Tests**

```bash
# Terminal 3
./test-all-features.sh
```

**What it tests:**
- ✅ Webhook receives appointment data
- ✅ Confirmation SMS sent immediately
- ✅ 24-hour reminder detected
- ✅ 2-hour reminder detected
- ✅ No-show follow-up with rebook link
- ✅ Waitlist: only first person texted
- ✅ Different client configs work
- ✅ Timezone handling correct

### 4. **Verify Output**

**Check Terminal 1 (npm run dev):**
- Look for HTTP 200/201 responses
- Look for `[SMS MOCK]` messages
- Each SMS should have correct business name, phone, time

**Check Terminal 2 (npm run reminders:dev):**
- Every hour: "Running 24h reminder check"
- Every 30 minutes: "Running 2h reminder check"
- When appointments are due: SMS messages appear

**Check Terminal 3 (test script):**
- `✅ PASS` for each test
- All webhook responses show `success: true`

---

## Manual Verification (If You Want Full Control)

### Test 1: Create an Appointment

```bash
# Generate signature
PAYLOAD='{"clientId":"dental-office-1","customerName":"John Doe","customerPhone":"+15551234567","appointmentDateTime":"2026-07-15T14:30:00Z","serviceType":"Cleaning"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "test-secret-key" | cut -d' ' -f2)

# Send webhook
curl -X POST http://localhost:3000/api/webhooks/appointments \
  -H "Content-Type: application/json" \
  -H "x-appointment-signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

**Expected Response:**
```json
{
  "success": true,
  "appointmentId": "apt_1234567_abc123",
  "message": "Appointment created and confirmation text sent"
}
```

**Check Terminal 1 for:**
```
[SMS MOCK] To: +15551234567, Message: "Hi John Doe, your appointment is confirmed for Jul 15 at 2:30 PM..."
```

✅ **PASS**: If you see the SMS message

### Test 2: Verify Configuration (Business Name, Message Wording)

Create appointment for different client:

```bash
PAYLOAD='{"clientId":"salon-1","customerName":"Jane Smith","customerPhone":"+13125550200","appointmentDateTime":"2026-07-15T14:30:00Z","serviceType":"Haircut"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "test-secret-key" | cut -d' ' -f2)

curl -X POST http://localhost:3000/api/webhooks/appointments \
  -H "Content-Type: application/json" \
  -H "x-appointment-signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

**Compare the SMS messages:**
- **Dental**: "Hi John Doe, your appointment is confirmed..."
- **Salon**: "Hey Jane! Your appointment at The Hair Studio is booked..."

✅ **PASS**: If business name and tone are different

### Test 3: Verify Timezone

Create two appointments at same UTC time:

```bash
# NYC (UTC-5) - 6 PM UTC = 1 PM EDT
NY='{"clientId":"dental-office-1","customerName":"Test","customerPhone":"+12125550100","appointmentDateTime":"2026-07-15T18:00:00Z","serviceType":"Cleaning"}'

# LA (UTC-8) - 6 PM UTC = 10 AM PDT
LA='{"clientId":"salon-1","customerName":"Test","customerPhone":"+13105550200","appointmentDateTime":"2026-07-15T18:00:00Z","serviceType":"Haircut"}'
```

**Compare SMS times:**
- **NY SMS**: "...appointment for Jul 15 at 1:00 PM..."
- **LA SMS**: "...appointment for Jul 15 at 10:00 AM..."

✅ **PASS**: If same UTC time shows different local times

### Test 4: No-Show

```bash
# First create appointment (get the appointment ID from response)
PAYLOAD='{"clientId":"dental-office-1","customerName":"Mike Brown","customerPhone":"+15558888888","appointmentDateTime":"2026-07-10T10:00:00Z","serviceType":"Cleaning"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "test-secret-key" | cut -d' ' -f2)

RESPONSE=$(curl -s -X POST http://localhost:3000/api/webhooks/appointments \
  -H "Content-Type: application/json" \
  -H "x-appointment-signature: $SIGNATURE" \
  -d "$PAYLOAD")

# Extract appointment ID
APPT_ID=$(echo "$RESPONSE" | grep -o '"appointmentId":"[^"]*"' | cut -d'"' -f4)

# Now mark as no-show
NO_SHOW_PAYLOAD="{\"clientId\":\"dental-office-1\",\"appointmentId\":\"$APPT_ID\"}"
NO_SHOW_SIGNATURE=$(echo -n "$NO_SHOW_PAYLOAD" | openssl dgst -sha256 -hmac "test-secret-key" | cut -d' ' -f2)

curl -X POST http://localhost:3000/api/webhooks/no-show \
  -H "Content-Type: application/json" \
  -H "x-appointment-signature: $NO_SHOW_SIGNATURE" \
  -d "$NO_SHOW_PAYLOAD"
```

**Check Terminal 1 for:**
```
[SMS MOCK] To: +15558888888, Message: "We noticed you missed your appointment. We'd love to reschedule! Call..."
```

✅ **PASS**: If follow-up SMS appears with rebook link

### Test 5: Waitlist

```bash
# Add person 1
WL1='{"action":"add","clientId":"dental-office-1","customerName":"Alice","customerPhone":"+15557777777","serviceType":"Cleaning"}'
SIGNATURE=$(echo -n "$WL1" | openssl dgst -sha256 -hmac "test-secret-key" | cut -d' ' -f2)

curl -s -X POST http://localhost:3000/api/webhooks/waitlist \
  -H "Content-Type: application/json" \
  -H "x-appointment-signature: $SIGNATURE" \
  -d "$WL1"

# Add person 2
WL2='{"action":"add","clientId":"dental-office-1","customerName":"Bob","customerPhone":"+15556666666","serviceType":"Cleaning"}'
SIGNATURE=$(echo -n "$WL2" | openssl dgst -sha256 -hmac "test-secret-key" | cut -d' ' -f2)

curl -s -X POST http://localhost:3000/api/webhooks/waitlist \
  -H "Content-Type: application/json" \
  -H "x-appointment-signature: $SIGNATURE" \
  -d "$WL2"

# Now a slot opens - notify waitlist
NOTIFY='{"action":"notify","clientId":"dental-office-1","serviceType":"Cleaning","slotDateTime":"2026-07-20T14:30:00Z"}'
SIGNATURE=$(echo -n "$NOTIFY" | openssl dgst -sha256 -hmac "test-secret-key" | cut -d' ' -f2)

curl -s -X POST http://localhost:3000/api/webhooks/waitlist \
  -H "Content-Type: application/json" \
  -H "x-appointment-signature: $SIGNATURE" \
  -d "$NOTIFY"
```

**Check Terminal 1 for:**
```
[SMS MOCK] To: +15557777777, Message: "Hi Alice, great news! We have an opening for Cleaning..."
```

**Do NOT see:**
```
[SMS MOCK] To: +15556666666, Message: ...  (Bob should NOT be texted)
```

✅ **PASS**: If only Alice is texted, Bob is not

---

## Comprehensive Verification Checklist

```
WEBHOOKS
☑ POST /api/webhooks/appointments returns 201
☑ POST /api/webhooks/no-show returns 200
☑ POST /api/webhooks/waitlist returns 201 or 200

SMS DELIVERY (MOCKED)
☑ Confirmation SMS appears in Terminal 1
☑ SMS shows correct customer name
☑ SMS shows correct appointment time (local)
☑ SMS shows correct business name

REMINDERS
☑ Terminal 2 shows "Running 24h reminder check"
☑ Terminal 2 shows "Running 2h reminder check"
☑ When appointment ~24h away, reminder SMS appears
☑ When appointment ~2h away, reminder SMS appears

NO-SHOW
☑ Status updated from "scheduled" to "noshow"
☑ Follow-up SMS sent with rebook link
☑ SMS shows correct business phone

WAITLIST
☑ Add to waitlist: returns 201
☑ Notify waitlist: returns 200 when people waiting
☑ Only first person receives slot notification SMS
☑ Second/third person do NOT receive SMS
☑ Confirm: removes person from waiting list

CONFIGURATION
☑ Different clients show different business names
☑ Different clients show different phone numbers
☑ Different clients show different message wording
☑ LA client has 2h reminders DISABLED (only 24h)
☑ Other clients have both 24h and 2h

TIMEZONE
☑ Same UTC time → different local times in SMS
☑ NY shows 1 PM, LA shows 10 AM, for 6 PM UTC
☑ Reminder fires at client's LOCAL time (not UTC)
☑ All times include timezone abbreviation (EDT, PDT, etc)
```

---

## What Could Be Wrong

### ❌ No SMS messages appearing

1. Check API is running: `http://localhost:3000`
2. Check for errors in Terminal 1
3. Verify webhook signature matches
4. Try the curl examples above, not just the script

### ❌ Reminders not firing

1. Check reminder service is running in Terminal 2
2. Look for "Running 24h reminder check" or "Running 2h reminder check" in Terminal 2
3. Reminders check every hour at :00 for 24h, every 30 min for 2h
4. For immediate test, appointment time needs to be ~24h or ~2h away

### ❌ Wrong timezone showing

1. Check appointment datetime is in UTC format (ends with Z)
2. Check client config has correct timezone (e.g., "America/New_York")
3. Verify SMS shows correct local time for that timezone

### ❌ Wrong business name in SMS

1. Check client config is registered with correct `clientId`
2. Check `businessName` matches your client
3. Verify webhook payload uses correct `clientId`

---

## Success Criteria

**The system is working if:**

1. ✅ You see `[SMS MOCK]` messages in Terminal 1
2. ✅ Confirmation SMS has correct business name + phone
3. ✅ Confirmation SMS shows correct local time (timezone-aware)
4. ✅ Reminders check every hour (Terminal 2)
5. ✅ No-show SMS includes rebook link
6. ✅ Waitlist only texts first person, not others
7. ✅ All webhook endpoints return 200/201

**If all 7 above are ✅, the system is production-ready.**

---

## Production Setup

Once everything above works, to use **real SMS** and **real data storage**:

1. **Get Twilio account**: https://twilio.com
2. **Set real Twilio credentials** in `.env.local`
3. **Get Google Sheets credentials** (service account)
4. **Set real Google Sheets** in `.env.local`
5. **Deploy to Vercel** (API) + Railway/Render (reminders)
6. Everything else stays exactly the same!

See `IMPLEMENTATION_GUIDE.md` for detailed setup.

---

## Files to Reference

- **`PROOF_OF_CONCEPT.md`** — Detailed step-by-step testing with expected output
- **`test-all-features.sh`** — Automated test script
- **`VERIFICATION_REPORT.md`** — Core functions verification (12/12 passing)
- **`CONFIGURATION_TESTING_GUIDE.md`** — Configuration and timezone testing
- **`QUICKSTART.md`** — 10-minute quick start

---

## TL;DR

```bash
# 1. Start services
npm run dev &
npm run reminders:dev &

# 2. Run test
./test-all-features.sh

# 3. Look for [SMS MOCK] messages
# 4. If you see them, system is working ✅
```
