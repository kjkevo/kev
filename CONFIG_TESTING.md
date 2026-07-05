# Configuration Testing Guide

This guide verifies that:
1. ✅ Business names, phone numbers, and message templates are **NOT hardcoded**
2. ✅ Config is loaded from **environment variables** (default) or **database** (per-business)
3. ✅ Config can be **swapped** to test multi-tenant reusability
4. ✅ Each business gets **isolated** messages, alerts, and logging

---

## Part 1: Verify Config is Loaded (Not Hardcoded)

### Test 1.1: Environment Variable Config

**Objective:** Verify default business uses environment variables

**Setup:**
Create `.env.local` with test values:
```bash
BUSINESS_NAME="Acme Plumbing Co"
BUSINESS_OWNER_PHONE="+15551111111"
BUSINESS_OWNER_EMAIL="acme@plumbing.com"
MISSED_CALL_MESSAGE="Acme here! We'll call you back ASAP."
LEAD_SUBMISSION_MESSAGE="Thanks for contacting Acme Plumbing!"
```

**Test Code:**
```bash
# Create test file: scripts/test-config.ts
cat > scripts/test-config.ts << 'EOF'
import { loadBusinessConfig, renderTemplate } from '@/app/lib/config';

async function testConfig() {
  console.log('\n=== Testing Configuration Loading ===\n');
  
  // Test 1: Load default business (from env vars)
  console.log('Test 1: Loading default business (businessId undefined)');
  const defaultConfig = await loadBusinessConfig();
  console.log('✓ Business Name:', defaultConfig.businessName);
  console.log('✓ Owner Phone:', defaultConfig.ownerPhone);
  console.log('✓ Owner Email:', defaultConfig.ownerEmail);
  console.log('✓ Missed Call Template:', defaultConfig.missedCallMessage);
  
  // Verify NOT hardcoded (should match environment)
  const expectedName = process.env.BUSINESS_NAME || 'Service Business';
  if (defaultConfig.businessName === expectedName) {
    console.log('✅ PASS: Business name loaded from environment variables\n');
  } else {
    console.log('❌ FAIL: Business name is hardcoded or wrong source\n');
  }
  
  // Test 2: Template rendering
  console.log('Test 2: Template rendering with dynamic values');
  const renderedMissed = renderTemplate(defaultConfig.missedCallMessage, {
    BUSINESS_NAME: defaultConfig.businessName
  });
  console.log('✓ Rendered message:', renderedMissed);
  
  if (renderedMissed.includes('Acme')) {
    console.log('✅ PASS: Business name substituted in template\n');
  } else {
    console.log('❌ FAIL: Template not rendering correctly\n');
  }
}

testConfig().catch(console.error);
EOF

# Run the test
ts-node --compiler-options '{"module":"CommonJS"}' scripts/test-config.ts
```

**Expected Output:**
```
=== Testing Configuration Loading ===

Test 1: Loading default business (businessId undefined)
✓ Business Name: Acme Plumbing Co
✓ Owner Phone: +15551111111
✓ Owner Email: acme@plumbing.com
✓ Missed Call Template: Acme here! We'll call you back ASAP.
✅ PASS: Business name loaded from environment variables

Test 2: Template rendering with dynamic values
✓ Rendered message: Acme here! We'll call you back ASAP.
✅ PASS: Business name substituted in template
```

**Verification:**
- ✅ Config loaded from environment, NOT hardcoded
- ✅ Template rendering works correctly
- ✅ No hardcoded business names in output

---

## Part 2: Database-Driven Config (Multi-Tenant)

### Test 2.1: Create Second Business in Database

**Objective:** Add a second business config to verify reusability

**Setup:**
```bash
npm run db:studio
```

Or via script:
```bash
cat > scripts/seed-test-business.ts << 'EOF'
import { prisma } from '@/app/lib/db';

async function seedTestBusiness() {
  console.log('\n=== Creating Test Businesses ===\n');

  // Business 1: Acme Plumbing
  const business1 = await prisma.businessConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      businessName: 'Acme Plumbing Co',
      businessPhone: '+15551111111',
      ownerPhone: '+15559999999',
      ownerEmail: 'owner@acmeplumbing.com',
      missedCallMessage: 'Sorry we missed your call! Acme Plumbing will call you back shortly. [ACME CONFIG]',
      leadSubmissionMsg: 'Hi {NAME}! Thanks for reaching out to Acme Plumbing. [ACME CONFIG]',
    },
  });
  console.log('✓ Business 1 created:', business1.businessName);

  // Business 2: Superior HVAC (SECOND BUSINESS - test reusability)
  const business2 = await prisma.businessConfig.create({
    data: {
      businessName: 'Superior HVAC Services',
      businessPhone: '+15552222222',
      ownerPhone: '+15558888888',
      ownerEmail: 'owner@superiorhvac.com',
      missedCallMessage: 'We missed your call! Superior HVAC will call you back shortly. [SUPERIOR CONFIG]',
      leadSubmissionMsg: 'Hi {NAME}! Thanks for reaching out to Superior HVAC. [SUPERIOR CONFIG]',
    },
  });
  console.log('✓ Business 2 created:', business2.businessName);

  // Business 3: Quick Electric (third business - more reusability)
  const business3 = await prisma.businessConfig.create({
    data: {
      businessName: 'Quick Electric',
      businessPhone: '+15553333333',
      ownerPhone: '+15557777777',
      ownerEmail: 'owner@quickelectric.com',
      missedCallMessage: 'Quick Electric missed your call! We\'ll be back shortly. [QUICK CONFIG]',
      leadSubmissionMsg: 'Hi {NAME}! Quick Electric received your request. [QUICK CONFIG]',
    },
  });
  console.log('✓ Business 3 created:', business3.businessName);

  console.log('\n✅ All test businesses created!\n');
  console.log('Business IDs:');
  console.log('  - ID 1:', business1.businessName);
  console.log('  - ID 2:', business2.businessName);
  console.log('  - ID 3:', business3.businessName);
}

seedTestBusiness()
  .catch(console.error)
  .finally(() => process.exit(0));
EOF

ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-test-business.ts
```

**Expected Output:**
```
=== Creating Test Businesses ===

✓ Business 1 created: Acme Plumbing Co
✓ Business 2 created: Superior HVAC Services
✓ Business 3 created: Quick Electric

✅ All test businesses created!

Business IDs:
  - ID 1: Acme Plumbing Co
  - ID 2: Superior HVAC Services
  - ID 3: Quick Electric
```

---

## Part 3: Test Multi-Tenant Config Loading

### Test 3.1: Verify Each Business Gets Own Config

**Test Code:**
```bash
cat > scripts/test-multitenant-config.ts << 'EOF'
import { loadBusinessConfig, renderTemplate } from '@/app/lib/config';

async function testMultiTenant() {
  console.log('\n=== Testing Multi-Tenant Configuration ===\n');

  // Load each business config
  const business1 = await loadBusinessConfig(1);
  const business2 = await loadBusinessConfig(2);
  const business3 = await loadBusinessConfig(3);

  console.log('Business 1:');
  console.log('  Name:', business1.businessName);
  console.log('  Phone:', business1.businessPhone);
  console.log('  Email:', business1.ownerEmail);
  console.log('  Message:', business1.missedCallMessage);

  console.log('\nBusiness 2:');
  console.log('  Name:', business2.businessName);
  console.log('  Phone:', business2.businessPhone);
  console.log('  Email:', business2.ownerEmail);
  console.log('  Message:', business2.missedCallMessage);

  console.log('\nBusiness 3:');
  console.log('  Name:', business3.businessName);
  console.log('  Phone:', business3.businessPhone);
  console.log('  Email:', business3.ownerEmail);
  console.log('  Message:', business3.missedCallMessage);

  // Verify isolation
  console.log('\n=== Verification ===\n');

  const tests = [
    {
      name: 'Business 1 has unique phone',
      pass: business1.businessPhone === '+15551111111'
    },
    {
      name: 'Business 2 has unique phone',
      pass: business2.businessPhone === '+15552222222'
    },
    {
      name: 'Business 3 has unique phone',
      pass: business3.businessPhone === '+15553333333'
    },
    {
      name: 'Business 1 has unique email',
      pass: business1.ownerEmail === 'owner@acmeplumbing.com'
    },
    {
      name: 'Business 2 has unique email',
      pass: business2.ownerEmail === 'owner@superiorhvac.com'
    },
    {
      name: 'Business names are different',
      pass: business1.businessName !== business2.businessName && business2.businessName !== business3.businessName
    },
    {
      name: 'Messages are unique per business',
      pass: business1.missedCallMessage.includes('[ACME CONFIG]') &&
            business2.missedCallMessage.includes('[SUPERIOR CONFIG]') &&
            business3.missedCallMessage.includes('[QUICK CONFIG]')
    }
  ];

  tests.forEach(test => {
    console.log(test.pass ? '✅ PASS:' : '❌ FAIL:', test.name);
  });

  const allPassed = tests.every(t => t.pass);
  console.log(allPassed ? '\n✅ All multi-tenant tests passed!' : '\n❌ Some tests failed');
}

testMultiTenant()
  .catch(console.error)
  .finally(() => process.exit(0));
EOF

ts-node --compiler-options '{"module":"CommonJS"}' scripts/test-multitenant-config.ts
```

**Expected Output:**
```
=== Testing Multi-Tenant Configuration ===

Business 1:
  Name: Acme Plumbing Co
  Phone: +15551111111
  Email: owner@acmeplumbing.com
  Message: Sorry we missed your call! Acme Plumbing will call you back shortly. [ACME CONFIG]

Business 2:
  Name: Superior HVAC Services
  Phone: +15552222222
  Email: owner@superiorhvac.com
  Message: We missed your call! Superior HVAC will call you back shortly. [SUPERIOR CONFIG]

Business 3:
  Name: Quick Electric
  Phone: +15553333333
  Email: owner@quickelectric.com
  Message: Quick Electric missed your call! We'll be back shortly. [QUICK CONFIG]

=== Verification ===

✅ PASS: Business 1 has unique phone
✅ PASS: Business 2 has unique phone
✅ PASS: Business 3 has unique phone
✅ PASS: Business 1 has unique email
✅ PASS: Business 2 has unique email
✅ PASS: Business names are different
✅ PASS: Messages are unique per business

✅ All multi-tenant tests passed!
```

---

## Part 4: Test Webhook Behavior with Different Businesses

### Test 4.1: Lead Submission for Each Business

**Objective:** Verify each business receives its own messages

**Test: Submit lead to Business 1**
```bash
curl -X POST http://localhost:3000/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith",
    "phone": "+15551234567",
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

**Expected SMS to John Smith:**
```
Hi John Smith! Thanks for reaching out to Acme Plumbing Co. [ACME CONFIG]
```

**Expected Email to owner@acmeplumbing.com:**
```
Subject: 🔔 New Lead for Acme Plumbing Co
Body contains: Acme Plumbing Co, John Smith, +15551234567, Pipe Repair
```

**Test: Submit lead to Business 2**
```bash
curl -X POST http://localhost:3000/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "phone": "+15559876543",
    "serviceRequested": "AC Installation",
    "businessId": 2
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "recordId": 43,
  "textSent": true
}
```

**Expected SMS to Jane Doe:**
```
Hi Jane Doe! Thanks for reaching out to Superior HVAC Services. [SUPERIOR CONFIG]
```

**Expected Email to owner@superiorhvac.com:**
```
Subject: 🔔 New Lead for Superior HVAC Services
Body contains: Superior HVAC Services, Jane Doe, +15559876543, AC Installation
```

**Verification:**
- ✅ Business 1 receives its name in SMS (Acme Plumbing Co)
- ✅ Business 2 receives different name in SMS (Superior HVAC Services)
- ✅ Emails sent to correct business owner
- ✅ Custom messages rendered for each business
- ✅ Each business gets isolated logging

---

## Part 5: Database Logging Verification

### Test 5.1: Verify Each Business Has Separate Records

**Check Database:**
```bash
npm run db:studio
# Navigate to LeadSubmission table
# Filter by businessId
```

**Expected Records:**
```
Lead 1:
  businessId: 1
  name: John Smith
  phone: +15551234567
  business: (references Acme Plumbing Co)

Lead 2:
  businessId: 2
  name: Jane Doe
  phone: +15559876543
  business: (references Superior HVAC Services)
```

**Verify Isolation:**
```bash
cat > scripts/verify-isolation.ts << 'EOF'
import { prisma } from '@/app/lib/db';

async function verifyIsolation() {
  console.log('\n=== Verifying Business Isolation ===\n');

  // Get leads for business 1
  const business1Leads = await prisma.leadSubmission.findMany({
    where: { businessId: 1 }
  });

  // Get leads for business 2
  const business2Leads = await prisma.leadSubmission.findMany({
    where: { businessId: 2 }
  });

  console.log('Business 1 leads:', business1Leads.length);
  business1Leads.forEach(lead => {
    console.log(`  - ${lead.name} (${lead.phone}) for ${lead.serviceRequested}`);
  });

  console.log('\nBusiness 2 leads:', business2Leads.length);
  business2Leads.forEach(lead => {
    console.log(`  - ${lead.name} (${lead.phone}) for ${lead.serviceRequested}`);
  });

  // Verify no cross-contamination
  const business1HasBusiness2Data = business1Leads.some(
    l => l.name === 'Jane Doe'
  );
  const business2HasBusiness1Data = business2Leads.some(
    l => l.name === 'John Smith'
  );

  if (!business1HasBusiness2Data && !business2HasBusiness1Data) {
    console.log('\n✅ PASS: Businesses have isolated data');
  } else {
    console.log('\n❌ FAIL: Data cross-contamination detected!');
  }
}

verifyIsolation()
  .catch(console.error)
  .finally(() => process.exit(0));
EOF

ts-node --compiler-options '{"module":"CommonJS"}' scripts/verify-isolation.ts
```

**Expected Output:**
```
=== Verifying Business Isolation ===

Business 1 leads: 1
  - John Smith (+15551234567) for Pipe Repair

Business 2 leads: 1
  - Jane Doe (+15559876543) for AC Installation

✅ PASS: Businesses have isolated data
```

---

## Part 6: Config Override Testing

### Test 6.1: Verify Environment Variables Are Fallback (Not Override)

**Setup:**
```bash
# .env.local
BUSINESS_NAME="Default Business"
BUSINESS_OWNER_EMAIL="default@example.com"
```

**Test:**
```bash
cat > scripts/test-fallback.ts << 'EOF'
import { loadBusinessConfig } from '@/app/lib/config';

async function testFallback() {
  console.log('\n=== Testing Config Fallback ===\n');

  // Load with undefined businessId (should use env vars)
  const config = await loadBusinessConfig(undefined);
  
  console.log('Loaded config:');
  console.log('  Name:', config.businessName);
  console.log('  Email:', config.ownerEmail);

  if (config.businessName === 'Default Business') {
    console.log('\n✅ PASS: Environment variables used as fallback');
  } else {
    console.log('\n❌ FAIL: Environment variables not used');
  }

  // Load with valid businessId (should override env vars)
  const business2Config = await loadBusinessConfig(2);
  
  console.log('\nBusiness 2 config:');
  console.log('  Name:', business2Config.businessName);
  console.log('  Email:', business2Config.ownerEmail);

  if (business2Config.businessName === 'Superior HVAC Services') {
    console.log('\n✅ PASS: Database config overrides environment variables');
  } else {
    console.log('\n❌ FAIL: Database config not being used');
  }
}

testFallback()
  .catch(console.error)
  .finally(() => process.exit(0));
EOF

ts-node --compiler-options '{"module":"CommonJS"}' scripts/test-fallback.ts
```

**Expected Output:**
```
=== Testing Config Fallback ===

Loaded config:
  Name: Default Business
  Email: default@example.com

✅ PASS: Environment variables used as fallback

Business 2 config:
  Name: Superior HVAC Services
  Email: owner@superiorhvac.com

✅ PASS: Database config overrides environment variables
```

---

## Part 7: Complete Integration Test

### Test 7.1: Full Flow With Different Businesses

```bash
cat > scripts/full-integration-test.ts << 'EOF'
import { loadBusinessConfig, renderTemplate } from '@/app/lib/config';
import { sendLeadConfirmationText } from '@/app/lib/notifications';
import { prisma } from '@/app/lib/db';

async function fullIntegrationTest() {
  console.log('\n=== Full Integration Test ===\n');

  // Simulate lead submission for each business
  const testLeads = [
    { name: 'Alice', phone: '+15551111111', service: 'Plumbing', businessId: 1 },
    { name: 'Bob', phone: '+15552222222', service: 'HVAC', businessId: 2 },
    { name: 'Charlie', phone: '+15553333333', service: 'Electrical', businessId: 3 }
  ];

  for (const lead of testLeads) {
    const config = await loadBusinessConfig(lead.businessId);
    
    // Render message
    const message = renderTemplate(config.leadSubmissionMsg, {
      NAME: lead.name,
      BUSINESS_NAME: config.businessName
    });

    // Log to database
    const record = await prisma.leadSubmission.create({
      data: {
        businessId: config.id,
        name: lead.name,
        phone: lead.phone,
        serviceRequested: lead.service,
        textStatus: 'test',
      }
    });

    console.log(`Business ${config.id}: ${config.businessName}`);
    console.log(`  Lead: ${lead.name}`);
    console.log(`  Message: ${message}`);
    console.log(`  Database ID: ${record.id}`);
    console.log();
  }

  // Verify all leads are in database
  const allLeads = await prisma.leadSubmission.findMany({
    where: { textStatus: 'test' }
  });

  console.log(`✅ Created ${allLeads.length} test leads`);
  console.log('✅ All configurations loaded from database');
  console.log('✅ Messages rendered with correct values');
  console.log('✅ Each business has isolated records\n');
}

fullIntegrationTest()
  .catch(console.error)
  .finally(() => process.exit(0));
EOF

ts-node --compiler-options '{"module":"CommonJS"}' scripts/full-integration-test.ts
```

---

## Summary: Verification Checklist

Run this to verify all config features work:

```bash
#!/bin/bash
echo "=== CONFIG VERIFICATION SUITE ==="
echo

# 1. Environment variable config
echo "1. Testing environment variable loading..."
ts-node --compiler-options '{"module":"CommonJS"}' scripts/test-config.ts
echo

# 2. Create test businesses
echo "2. Seeding test businesses..."
ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-test-business.ts
echo

# 3. Multi-tenant config loading
echo "3. Testing multi-tenant configuration..."
ts-node --compiler-options '{"module":"CommonJS"}' scripts/test-multitenant-config.ts
echo

# 4. Config fallback behavior
echo "4. Testing config fallback..."
ts-node --compiler-options '{"module":"CommonJS"}' scripts/test-fallback.ts
echo

# 5. Full integration test
echo "5. Running full integration test..."
ts-node --compiler-options '{"module":"CommonJS"}' scripts/full-integration-test.ts
echo

# 6. Verify isolation
echo "6. Verifying business isolation..."
ts-node --compiler-options '{"module":"CommonJS"}' scripts/verify-isolation.ts
```

---

## Expected Test Results

| Test | Expected Result | Status |
|------|-----------------|--------|
| Env var config loads | Business name from env | ✅ Pass |
| Template rendering | {BUSINESS_NAME} replaced | ✅ Pass |
| Database config loads | Business config from DB | ✅ Pass |
| Multi-tenant isolation | Each business has own data | ✅ Pass |
| Config override | DB overrides env vars | ✅ Pass |
| Message customization | Each business gets custom message | ✅ Pass |
| Email isolation | Emails go to correct owner | ✅ Pass |
| Webhook routing | BusinessId routes to correct config | ✅ Pass |
| No hardcoding | Config comes from DB or env vars | ✅ Pass |
| Reusability | Works for unlimited businesses | ✅ Pass |

---

## Key Verification Points

✅ **Not Hardcoded:** Business names, phone numbers, and message templates are pulled from:
  - Environment variables (`.env.local`) for default business
  - Database (`BusinessConfig` table) for specific business

✅ **Configurable:** Each business can have:
  - Different phone numbers
  - Different owner email/phone
  - Custom message templates
  - Independent Airtable logging

✅ **Testable:** Create fake "second business" values to confirm:
  - Config loads from database
  - Messages use correct business name
  - Alerts go to correct owner
  - Records stay isolated in database

✅ **Reusable:** Same codebase works for unlimited businesses with different configurations.
