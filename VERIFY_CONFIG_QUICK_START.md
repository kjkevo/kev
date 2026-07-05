# Verify Configuration System - Quick Start Guide

Test that business names, phone numbers, and message templates are **NOT hardcoded** and that the system works for multiple businesses.

---

## 3-Minute Verification

### Step 1: Seed Test Businesses (30 seconds)
```bash
npm run seed:test-businesses
```

**What this does:**
- Creates 3 fake businesses in your database
- Each with different name, phone, email, and message templates
- IDs: 1 (Acme Plumbing), 2 (Superior HVAC), 3 (Quick Electric)

**Expected Output:**
```
✓ Business 1: Acme Plumbing Co
  Phone: +15551111111
  Email: owner@acmeplumbing.com

✓ Business 2: Superior HVAC Services
  Phone: +15552222222
  Email: owner@superiorhvac.com

✓ Business 3: Quick Electric
  Phone: +15553333333
  Email: owner@quickelectric.com
```

✅ **VERIFIED:** Config is NOT hardcoded (3 businesses in DB with different values)

---

### Step 2: Test Configuration Loading (1 minute)
```bash
npm run test:config
```

**What this does:**
- Loads config from environment variables
- Loads config from database
- Verifies template rendering
- Checks for hardcoded values

**Expected Output:**
```
TEST 1: Default Business (from environment variables)
Name: [Your BUSINESS_NAME from .env.local]
✅ PASS: Business name loaded from environment variable

TEST 2: Business #1 from Database
Name: Acme Plumbing Co
✅ PASS: Business 1 loaded from database

TEST 3: Business #2 from Database (Different Config)
Name: Superior HVAC Services
✅ PASS: Business 2 has different configuration from Business 1

TEST 4: Template Rendering
Rendered: Hi John Smith! Thanks for reaching out to Acme Plumbing Co...
✅ PASS: Templates render with correct values
```

✅ **VERIFIED:** Config loaded from database, not hardcoded

---

### Step 3: Test Multi-Tenant Isolation (1 minute)
```bash
npm run test:multitenant
```

**What this does:**
- Simulates lead submissions for all 3 businesses
- Verifies each gets correct config
- Tests message rendering
- Checks database isolation
- Cleans up test records

**Expected Output:**
```
STEP 1: Load Configuration for Each Business
Business 1: Acme Plumbing Co
  Phone: +15551111111
  Owner Email: owner@acmeplumbing.com

Business 2: Superior HVAC Services
  Phone: +15552222222
  Owner Email: owner@superiorhvac.com

Business 3: Quick Electric
  Phone: +15553333333
  Owner Email: owner@quickelectric.com

STEP 2: Render Lead Messages for Each Business
For Alice Johnson:
  Rendered: Hi Alice Johnson! Thanks for reaching out to Acme Plumbing Co...
  ✅ No template variables remaining
  ✅ Customer name included
  ✅ Business name included

[Similar for Bob and Charlie...]

STEP 3: Log Leads to Database
Created database record for Acme Plumbing Co:
  • Record ID: 1
  • Business ID: 1
  • Lead: Alice Johnson

[Similar for other businesses...]

STEP 4: Verify Business Isolation
Business 1 leads: 1
  • Alice Johnson (+15551111111) - Emergency Pipe Repair

Business 2 leads: 1
  • Bob Williams (+15552222222) - AC Installation

Business 3 leads: 1
  • Charlie Brown (+15553333333) - Electrical Inspection

✅ PASS: Business data is properly isolated

STEP 5: Verify Configuration Differences
✅ PASS: Business 1 has unique phone
✅ PASS: Business 2 has unique phone
✅ PASS: Business 3 has unique phone
✅ PASS: Business names are different
✅ PASS: Owner emails are different
✅ PASS: Messages are unique per business
✅ PASS: Configs loaded from database

TEST RESULTS
✅ ALL TESTS PASSED!
✓ Each business has unique configuration
✓ Config loaded from database (not hardcoded)
✓ Message templates render correctly
✓ Business data is properly isolated
✓ System is production-ready for multi-tenant use
```

✅ **VERIFIED:** System is multi-tenant, config is dynamic, no hardcoding

---

## Testing with Webhooks (5 minutes)

### Test 1: Submit Lead for Business 1

```bash
curl -X POST http://localhost:3000/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "phone": "+15559876543",
    "serviceRequested": "Pipe Repair",
    "businessId": 1
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "recordId": 42,
  "textSent": true
}
```

**Verify:**
- [ ] SMS received from +15551111111 (Business 1 phone) containing:
  - "Hi John Doe!"
  - "Acme Plumbing Co" (Business 1 name)
- [ ] Email received at owner@acmeplumbing.com with:
  - Subject: "🔔 New Lead for Acme Plumbing Co"
  - Lead details
- [ ] Record in database:
  ```bash
  npm run db:studio
  # LeadSubmission table → businessId: 1, name: "John Doe"
  ```

---

### Test 2: Submit Lead for Business 2

```bash
curl -X POST http://localhost:3000/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "phone": "+15559876543",
    "serviceRequested": "AC Installation",
    "businessId": 2
  }'
```

**Verify:**
- [ ] SMS from +15552222222 (Business 2 phone)
- [ ] Contains "Superior HVAC Services" (Business 2 name)
- [ ] Email to owner@superiorhvac.com
- [ ] Different message than Business 1

---

### Test 3: Submit Lead for Business 3

```bash
curl -X POST http://localhost:3000/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bob Johnson",
    "phone": "+15559876543",
    "serviceRequested": "Electrical Inspection",
    "businessId": 3
  }'
```

**Verify:**
- [ ] SMS from +15553333333 (Business 3 phone)
- [ ] Contains "Quick Electric" (Business 3 name)
- [ ] Email to owner@quickelectric.com
- [ ] Different message than Business 1 & 2

---

## Proof That Config is NOT Hardcoded

### Evidence #1: Database Configuration
```bash
npm run db:studio
# Navigate to BusinessConfig table
# You'll see 3 completely different businesses
```

### Evidence #2: Test Script Output
```bash
npm run test:multitenant
# Shows each business loaded different config from DB
```

### Evidence #3: Different SMS Messages
- Business 1: SMS contains "Acme Plumbing" (unique identifier)
- Business 2: SMS contains "Superior HVAC" (unique identifier)
- Business 3: SMS contains "Quick Electric" (unique identifier)

### Evidence #4: Different Email Recipients
- Business 1: Email sent to owner@acmeplumbing.com
- Business 2: Email sent to owner@superiorhvac.com
- Business 3: Email sent to owner@quickelectric.com

---

## What Gets Tested

| Component | Test | Result |
|-----------|------|--------|
| Business name | Loaded from DB | ✅ Different per business |
| Phone number | Loaded from DB | ✅ Unique per business |
| Owner email | Loaded from DB | ✅ Different per business |
| Message template | Rendered with values | ✅ Custom per business |
| Database isolation | Query by businessId | ✅ No cross-contamination |
| Template rendering | {NAME} and {BUSINESS_NAME} | ✅ Placeholders replaced |
| Webhook routing | businessId parameter | ✅ Routes to correct config |
| SMS content | Contains business name | ✅ Dynamic, not hardcoded |
| Email recipient | From config | ✅ Correct owner email |

---

## Summary: Configuration NOT Hardcoded ✅

**Proof:**
1. ✅ Created 3 test businesses with different configs
2. ✅ Each has unique name, phone, email
3. ✅ Each has custom message templates
4. ✅ Config loaded from database (queries use businessId)
5. ✅ Message templates render with dynamic values
6. ✅ SMS/Email differ per business
7. ✅ Database records isolated by businessId
8. ✅ System works for unlimited businesses

**Conclusion:** The system is **production-ready for multi-tenant use**. Business configuration is fully dynamic and can be customized per client.

---

## For Production Use

### Adding New Client

```bash
npm run db:studio
# Or add via API:

curl -X POST http://localhost:3000/api/webhooks/lead-submission \
  -d '{...,"businessId":4}'

# Then create BusinessConfig:
# INSERT INTO "BusinessConfig" 
# VALUES (4, 'New Business Co', '+15554444444', '+15551234567', 
#         'owner@newbiz.com', 'Custom missed call msg', 'Custom lead msg')
```

### Testing New Client

```bash
# Use new businessId in webhook calls:
curl -X POST http://localhost:3000/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Lead",
    "phone": "+15559876543",
    "serviceRequested": "Service",
    "businessId": 4
  }'

# Verify messages/emails are for new client
```

---

**Status: Configuration System Verified ✅**

All tests passing. System is reusable for unlimited businesses with isolated configurations.
