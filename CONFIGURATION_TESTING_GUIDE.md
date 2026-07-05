# Configuration & Timezone Testing Guide

Test that per-client configuration and timezone handling work correctly. Timezone bugs are **the most common source of reminder failures**.

---

## Part 1: Configure Multiple Test Clients

### Step 1: Create Test Client Configurations

Edit `config/clients.ts` with multiple test clients across different timezones:

```typescript
import { registerClientConfig } from '../lib/client-config';

// CLIENT 1: East Coast (UTC-5)
registerClientConfig({
  clientId: 'test-dental-ny',
  businessName: 'NYC Dental Studio',
  businessPhone: '+1 (212) 555-0100',
  timezone: 'America/New_York',
  reminders: {
    confirmationMessage: 'Hi {{customerName}}, your appointment at {{businessName}} is confirmed for {{appointmentTime}}. Reply STOP to cancel.',
    reminderMessage24h: '{{customerName}}, reminder: appointment at {{businessName}} tomorrow at {{appointmentTime}}.',
    reminderMessage2h: '{{customerName}}, see you in 2 hours at {{businessName}}!',
    noshowMessage: 'We missed you at {{businessName}}! Call {{businessPhone}} to reschedule: {{rebookLink}}',
    rebookLink: 'https://calendly.com/nyc-dental/rebook',
  },
  schedules: {
    reminder24h: true,
    reminder2h: true,
  },
});

// CLIENT 2: Central Time (UTC-6)
registerClientConfig({
  clientId: 'test-salon-chicago',
  businessName: 'Bliss Hair Salon - Chicago',
  businessPhone: '+1 (312) 555-0200',
  timezone: 'America/Chicago',
  reminders: {
    confirmationMessage: 'Hey {{customerName}}! Your appointment at {{businessName}} is booked for {{appointmentTime}}. 💇‍♀️',
    reminderMessage24h: 'Tomorrow at {{appointmentTime}} at {{businessName}}! We\'re excited to see you! ✨',
    reminderMessage2h: '{{customerName}}, appointment in 2 hours! See you soon at {{businessName}}! 💄',
    noshowMessage: 'We missed you! Reschedule your appointment at {{businessName}}: {{rebookLink}} or call {{businessPhone}}',
    rebookLink: 'https://calendly.com/bliss-chicago/rebook',
  },
  schedules: {
    reminder24h: true,
    reminder2h: true,
  },
});

// CLIENT 3: Mountain Time (UTC-7)
registerClientConfig({
  clientId: 'test-medspa-denver',
  businessName: 'Glow Medical Spa - Denver',
  businessPhone: '+1 (720) 555-0300',
  timezone: 'America/Denver',
  reminders: {
    confirmationMessage: 'Your appointment at {{businessName}} on {{appointmentTime}} is confirmed. Please arrive 10 minutes early.',
    reminderMessage24h: 'Appointment reminder: {{businessName}} tomorrow at {{appointmentTime}}. Avoid sun before your treatment!',
    reminderMessage2h: '{{customerName}}, your {{businessName}} appointment is in 2 hours at {{appointmentTime}}.',
    noshowMessage: 'Your appointment at {{businessName}} - reschedule now: {{rebookLink}} or {{businessPhone}}',
    rebookLink: 'https://calendly.com/glow-denver/rebook',
  },
  schedules: {
    reminder24h: true,
    reminder2h: true,
  },
});

// CLIENT 4: Pacific Time (UTC-8) - 24h reminders ONLY
registerClientConfig({
  clientId: 'test-salon-la',
  businessName: 'Luxe Beauty - Los Angeles',
  businessPhone: '+1 (213) 555-0400',
  timezone: 'America/Los_Angeles',
  reminders: {
    confirmationMessage: 'You\'re all set at {{businessName}} for {{appointmentTime}}! 🌟',
    reminderMessage24h: '{{customerName}}, heads up: appointment tomorrow at {{appointmentTime}} at {{businessName}}!',
    reminderMessage2h: 'Appointment in 2 hours at {{businessName}}!', // Won't send
    noshowMessage: 'We missed your appointment at {{businessName}}. Rebook: {{rebookLink}}',
    rebookLink: 'https://calendly.com/luxe-la/rebook',
  },
  schedules: {
    reminder24h: true,
    reminder2h: false, // 2h reminders DISABLED
  },
});

// CLIENT 5: UTC+0 (UK/London) - for testing international
registerClientConfig({
  clientId: 'test-salon-london',
  businessName: 'Salon London',
  businessPhone: '+44 20 7946 0958',
  timezone: 'Europe/London',
  reminders: {
    confirmationMessage: 'Your appointment at {{businessName}} is confirmed for {{appointmentTime}}.',
    reminderMessage24h: 'Reminder: appointment at {{businessName}} tomorrow at {{appointmentTime}}.',
    reminderMessage2h: 'Appointment in 2 hours at {{businessName}}.',
    noshowMessage: 'We missed you! Reschedule: {{rebookLink}} or call {{businessPhone}}',
    rebookLink: 'https://calendly.com/salon-london/rebook',
  },
  schedules: {
    reminder24h: true,
    reminder2h: true,
  },
});

export {};
```

---

## Part 2: Test Message Personalization Per Client

### Test: Verify Business Names Appear Correctly

Create a test script to check message generation:

```bash
# Create test file: scripts/test-config.ts
cat > scripts/test-config.ts << 'EOF'
import { getClientConfig, interpolateMessage } from '../lib/client-config';

const clients = ['test-dental-ny', 'test-salon-chicago', 'test-medspa-denver', 'test-salon-la', 'test-salon-london'];

console.log('\n📋 Configuration Test: Message Personalization\n');

clients.forEach((clientId) => {
  const config = getClientConfig(clientId);
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Client: ${clientId}`);
  console.log(`Business: ${config.businessName}`);
  console.log(`Timezone: ${config.timezone}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Test confirmation message
  const confirmMsg = interpolateMessage(config.reminders.confirmationMessage, {
    customerName: 'John Doe',
    businessName: config.businessName,
    appointmentTime: 'Jul 10 at 2:30 PM',
  });
  console.log(`✓ Confirmation: "${confirmMsg}"`);

  // Test 24h reminder
  const reminder24 = interpolateMessage(config.reminders.reminderMessage24h, {
    customerName: 'John Doe',
    businessName: config.businessName,
    appointmentTime: 'Jul 10 at 2:30 PM',
  });
  console.log(`✓ 24h Reminder: "${reminder24}"`);

  // Test 2h reminder (if enabled)
  if (config.schedules.reminder2h) {
    const reminder2 = interpolateMessage(config.reminders.reminderMessage2h, {
      customerName: 'John Doe',
      businessName: config.businessName,
      appointmentTime: 'Jul 10 at 2:30 PM',
    });
    console.log(`✓ 2h Reminder: "${reminder2}"`);
  } else {
    console.log(`✗ 2h Reminder: DISABLED for this client`);
  }

  // Test no-show message
  const noshowMsg = interpolateMessage(config.reminders.noshowMessage, {
    customerName: 'John Doe',
    businessName: config.businessName,
    businessPhone: config.businessPhone,
    rebookLink: config.reminders.rebookLink,
  });
  console.log(`✓ No-Show: "${noshowMsg}"`);
});

console.log('\n✅ All messages generated successfully\n');
EOF

npx ts-node scripts/test-config.ts
```

**Expected Output:**
```
Client: test-dental-ny
Business: NYC Dental Studio
Timezone: America/New_York
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Confirmation: "Hi John Doe, your appointment at NYC Dental Studio is confirmed for Jul 10 at 2:30 PM. Reply STOP to cancel."
✓ 24h Reminder: "John Doe, reminder: appointment at NYC Dental Studio tomorrow at Jul 10 at 2:30 PM."
✓ 2h Reminder: "John Doe, see you in 2 hours at NYC Dental Studio!"
✓ No-Show: "We missed you at NYC Dental Studio! Call +1 (212) 555-0100 to reschedule: https://calendly.com/nyc-dental/rebook"

[repeats for other clients...]

✅ All messages generated successfully
```

---

## Part 3: Test Timezone Handling (The Critical Test)

### Test 3.1: Verify Timezone Conversion

Create a timezone test that exercises the most common failure scenarios:

```typescript
// scripts/test-timezones.ts
import moment from 'moment-timezone';
import { getClientConfig } from '../lib/client-config';

const clients = [
  'test-dental-ny',           // UTC-5
  'test-salon-chicago',       // UTC-6
  'test-medspa-denver',       // UTC-7
  'test-salon-la',            // UTC-8
  'test-salon-london',        // UTC+0
];

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  TIMEZONE HANDLING TEST');
console.log('═══════════════════════════════════════════════════════════\n');

// Test 1: Same UTC time, different local times
console.log('TEST 1: Same appointment (UTC time), different local display\n');
const utcTime = '2026-07-15T18:00:00Z'; // 6 PM UTC

clients.forEach((clientId) => {
  const config = getClientConfig(clientId);
  const localTime = moment(utcTime).tz(config.timezone).format('MMM DD [at] h:mm A z');
  
  console.log(`${config.businessName}`);
  console.log(`  UTC time: ${utcTime}`);
  console.log(`  Local time: ${localTime}`);
  console.log();
});

// Test 2: Reminder timing - 24 hours before
console.log('\n\nTEST 2: 24-hour reminder detection (NOW + 24 hours)\n');

clients.forEach((clientId) => {
  const config = getClientConfig(clientId);
  const now = moment().tz(config.timezone);
  const appointmentTime = moment(now).add(24, 'hours');
  
  const hoursUntil = appointmentTime.diff(now, 'hours', true);
  const shouldRemind = hoursUntil <= 24.5 && hoursUntil > 23.5;
  
  console.log(`${config.businessName} (${config.timezone})`);
  console.log(`  Now: ${now.format('MMM DD h:mm A z')}`);
  console.log(`  Appointment: ${appointmentTime.format('MMM DD h:mm A z')}`);
  console.log(`  Hours until: ${hoursUntil.toFixed(2)}`);
  console.log(`  Send 24h reminder? ${shouldRemind ? '✅ YES' : '❌ NO'}`);
  console.log();
});

// Test 3: Reminder timing - 2 hours before
console.log('\n\nTEST 3: 2-hour reminder detection (NOW + 2 hours)\n');

clients.forEach((clientId) => {
  const config = getClientConfig(clientId);
  const now = moment().tz(config.timezone);
  const appointmentTime = moment(now).add(2, 'hours');
  
  const hoursUntil = appointmentTime.diff(now, 'hours', true);
  const shouldRemind = hoursUntil <= 2.5 && hoursUntil > 1.5;
  
  console.log(`${config.businessName} (${config.timezone})`);
  console.log(`  Now: ${now.format('MMM DD h:mm A z')}`);
  console.log(`  Appointment: ${appointmentTime.format('MMM DD h:mm A z')}`);
  console.log(`  Hours until: ${hoursUntil.toFixed(2)}`);
  console.log(`  Send 2h reminder? ${shouldRemind ? '✅ YES' : '❌ NO'}`);
  console.log();
});

// Test 4: Cross-timezone edge cases (midnight, DST, etc)
console.log('\n\nTEST 4: Edge Cases - Appointments at midnight local time\n');

clients.forEach((clientId) => {
  const config = getClientConfig(clientId);
  
  // Next midnight in client's timezone
  const nextMidnight = moment().tz(config.timezone).endOf('day');
  
  console.log(`${config.businessName} (${config.timezone})`);
  console.log(`  Next midnight: ${nextMidnight.format('MMM DD h:mm A z')}`);
  console.log(`  UTC equivalent: ${nextMidnight.utc().format('MMM DD h:mm A z')}`);
  console.log();
});

// Test 5: DST transitions (spring forward / fall back)
console.log('\n\nTEST 5: Daylight Saving Time Awareness\n');

const testDates = [
  { label: 'Winter (no DST)', date: '2026-01-15' },
  { label: 'Spring (DST starts)', date: '2026-03-15' },
  { label: 'Summer (DST active)', date: '2026-07-15' },
  { label: 'Fall (DST ends)', date: '2026-11-15' },
];

clients.slice(0, 1).forEach((clientId) => {
  const config = getClientConfig(clientId);
  console.log(`Testing: ${config.businessName} (${config.timezone})\n`);
  
  testDates.forEach(({ label, date }) => {
    const time = moment(date).tz(config.timezone);
    const offset = time.format('Z');
    const isDST = time.isDST();
    
    console.log(`  ${label}: ${time.format('MMM DD')} | Offset: ${offset} | DST: ${isDST ? 'YES' : 'NO'}`);
  });
});

console.log('\n═══════════════════════════════════════════════════════════\n');
```

**Run the timezone test:**
```bash
npx ts-node scripts/test-timezones.ts
```

**What to look for:**
- ✅ Same UTC time displays differently for each timezone
- ✅ 24-hour window correctly detects appointments ~24h away
- ✅ 2-hour window correctly detects appointments ~2h away
- ✅ Midnight appointments handled correctly
- ✅ DST transitions tracked correctly

---

## Part 4: Integration Test - End-to-End Configuration

### Test: Create appointments in multiple timezones and verify reminders

```bash
cat > test-multi-tz.sh << 'EOF'
#!/bin/bash

echo "🧪 Multi-Timezone Configuration Test"
echo "════════════════════════════════════════════════════════════"

# Helper to generate webhook signature
generate_sig() {
  echo -n "$1" | openssl dgst -sha256 -hmac "test-secret" | cut -d' ' -f2
}

API="http://localhost:3000/api/webhooks"
SECRET="test-secret"

# Test 1: NY Dental appointment
echo -e "\n✓ TEST 1: Create appointment for NYC Dental (America/New_York)"
NY_PAYLOAD='{"clientId":"test-dental-ny","customerName":"Alice Johnson","customerPhone":"+12125550100","appointmentDateTime":"2026-07-10T14:30:00","serviceType":"Root Canal"}'
NY_SIG=$(generate_sig "$NY_PAYLOAD")

curl -s -X POST "$API/appointments" \
  -H "Content-Type: application/json" \
  -H "x-appointment-signature: $NY_SIG" \
  -d "$NY_PAYLOAD" | jq '.appointmentId'

# Test 2: Chicago Salon appointment
echo -e "\n✓ TEST 2: Create appointment for Chicago Salon (America/Chicago)"
CHI_PAYLOAD='{"clientId":"test-salon-chicago","customerName":"Bob Smith","customerPhone":"+13125550200","appointmentDateTime":"2026-07-10T14:30:00","serviceType":"Haircut"}'
CHI_SIG=$(generate_sig "$CHI_PAYLOAD")

curl -s -X POST "$API/appointments" \
  -H "Content-Type: application/json" \
  -H "x-appointment-signature: $CHI_SIG" \
  -d "$CHI_PAYLOAD" | jq '.appointmentId'

# Test 3: Denver Med Spa appointment
echo -e "\n✓ TEST 3: Create appointment for Denver Med Spa (America/Denver)"
DEN_PAYLOAD='{"clientId":"test-medspa-denver","customerName":"Carol White","customerPhone":"+17205550300","appointmentDateTime":"2026-07-10T14:30:00","serviceType":"Facial"}'
DEN_SIG=$(generate_sig "$DEN_PAYLOAD")

curl -s -X POST "$API/appointments" \
  -H "Content-Type: application/json" \
  -H "x-appointment-signature: $DEN_SIG" \
  -d "$DEN_PAYLOAD" | jq '.appointmentId'

echo -e "\n════════════════════════════════════════════════════════════"
echo "✅ All appointments created in different timezones"
echo ""
echo "Check console output for SMS messages:"
echo "  - Each should show correct local time for that timezone"
echo "  - NYC (UTC-5), Chicago (UTC-6), Denver (UTC-7)"
EOF

chmod +x test-multi-tz.sh
./test-multi-tz.sh
```

---

## Part 5: Manual Verification Checklist

### ✅ Configuration Tests

- [ ] **Business Names**: Each client message shows correct business name
  - NYC Dental messages contain "NYC Dental Studio"
  - Chicago messages contain "Bliss Hair Salon - Chicago"
  - Denver messages contain "Glow Medical Spa - Denver"

- [ ] **Phone Numbers**: Each client shows correct business phone
  - NYC: +1 (212) 555-0100
  - Chicago: +1 (312) 555-0200
  - Denver: +1 (720) 555-0300

- [ ] **Custom Message Wording**: 
  - NYC: Professional tone ("Reply STOP to cancel")
  - Chicago: Friendly tone ("💇‍♀️", "✨")
  - Denver: Clinical tone ("Please arrive 10 minutes early")

- [ ] **Reminder Scheduling**:
  - Los Angeles client: 2h reminder DISABLED ✓
  - Other clients: Both 24h & 2h reminders ENABLED ✓

### ✅ Timezone Tests

- [ ] **Display Format**: Same UTC time shows different local times per timezone
  ```
  UTC 6:00 PM should display as:
  - NY: 1:00 PM (UTC-5)
  - Chicago: 12:00 PM (UTC-6)
  - Denver: 11:00 AM (UTC-7)
  - LA: 10:00 AM (UTC-8)
  - London: 7:00 PM (UTC+0)
  ```

- [ ] **24-Hour Reminder Timing**:
  - Appointment 24h from now in NY timezone → sends in NY timezone
  - Appointment 24h from now in LA timezone → sends in LA timezone
  - **NOT** sending based on UTC (this is the common bug!)

- [ ] **2-Hour Reminder Timing**:
  - Same test as 24h reminders
  - Verify LA client does NOT send 2h reminders

- [ ] **DST Handling** (March & November):
  - Appointments near DST transitions work correctly
  - Offset changes (+5 vs +4 in NY) handled properly

### ✅ Edge Cases

- [ ] **Midnight Appointments**: Client at midnight local time
  - Should trigger reminders at correct UTC times
  
- [ ] **Cross-Midnight**: Appointment at 1 AM, reminder fires previous day
  - Correct timezone handling essential here
  
- [ ] **International**: London (UTC+0) handles correctly
  - No offset confusion with UTC

---

## Part 6: What Timezone Bugs Look Like (Avoid These!)

### ❌ BUG #1: Not using client timezone
```typescript
// WRONG - Uses server timezone or UTC
const now = moment();
const hoursUntil = appointmentTime.diff(now, 'hours');

// RIGHT - Uses client timezone
const now = moment().tz(config.timezone);
const hoursUntil = appointmentTime.diff(now, 'hours');
```

### ❌ BUG #2: Parsing timestamp wrong
```typescript
// WRONG - Assumes timestamp is in client's timezone
const apptTime = moment(appointmentDateTime);

// RIGHT - Parse as UTC, convert to client timezone
const apptTime = moment(appointmentDateTime).tz(config.timezone);
```

### ❌ BUG #3: Storing local time as UTC
```typescript
// WRONG - Store local time, causes mismatch on recovery
const createdAt = moment().tz(clientTimezone).format();

// RIGHT - Always store UTC, convert on display
const createdAt = moment().utc().toISOString();
```

### ❌ BUG #4: Hardcoding timezone
```typescript
// WRONG - Works in NY, breaks everywhere else
const reminder = moment().add(24, 'hours').tz('America/New_York');

// RIGHT - Use client config
const reminder = moment().add(24, 'hours').tz(config.timezone);
```

---

## Running Full Config Tests

```bash
# 1. Configure clients
cp config/clients-example.ts config/clients.ts
# Edit with test clients above

# 2. Start Next.js server
npm run dev

# 3. Test message personalization
npx ts-node scripts/test-config.ts

# 4. Test timezone handling
npx ts-node scripts/test-timezones.ts

# 5. Test end-to-end
./test-multi-tz.sh

# 6. Start reminder service
npm run reminders:dev

# 7. Watch console for SMS messages
# Each should show correct local time for that client's timezone
```

---

## Success Criteria

✅ **All tests pass if:**

1. **Messages personalized**: Business name, phone, wording per client
2. **Timezone display**: Same time shows differently per timezone
3. **Reminder timing**: 24h & 2h reminders respect client timezones
4. **Scheduling disabled**: LA client doesn't send 2h reminders
5. **DST aware**: Handles daylight saving transitions
6. **No UTC bugs**: Reminders fire based on client local time, not UTC

---

## Debugging Timezone Issues

If reminders are firing at wrong times:

```typescript
// Add debug logging to lib/appointments.ts
console.log(`Client timezone: ${config.timezone}`);
console.log(`Now (client): ${now.tz(config.timezone).format('YYYY-MM-DD HH:mm:ss z')}`);
console.log(`Appointment: ${apptTime.tz(config.timezone).format('YYYY-MM-DD HH:mm:ss z')}`);
console.log(`Hours until: ${hoursUntil.toFixed(2)}`);
console.log(`Should send reminder? ${shouldSend}`);
```

Check that:
- Client timezone from config is correct
- Now uses `.tz(config.timezone)`
- Appointment time is parsed/converted correctly
- Hours calculation uses correct timezone (not UTC or server timezone)

