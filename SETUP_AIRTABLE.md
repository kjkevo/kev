# Airtable Setup Guide - Complete Instructions

This guide walks you through setting up Airtable to log all missed calls and leads.

**Alternative:** If you prefer Google Sheets, see SETUP_GOOGLE_SHEETS.md

---

## ✅ Prerequisites

- [ ] Airtable account created (free at airtable.com)
- [ ] New base created
- [ ] Basic understanding of Airtable tables

---

## Step 1: Create Airtable Base

### Option A: Create New Base

1. Go to [Airtable](https://airtable.com)
2. Log in to your account
3. Click **Add a base** or **Create a base**
4. Select **Start from scratch**
5. Name it: `Missed Call Automation` (or anything you like)
6. Click **Create base**

**You're now in the base editor**

### Option B: Use Existing Base

If you already have a base, just continue to Step 2.

---

## Step 2: Create Table 1 - Missed Calls

### Create the Table

1. In your base, click **Add a table** or **+ Add**
2. Name it: `Missed Calls`
3. Click **Create table**

### Add Columns

You'll see a default "Name" column. Let's keep it and add more.

**Column 1: Timestamp**
1. Click **+** to add new field
2. Name: `Timestamp`
3. Type: **Date** (with time)
4. Click **Save field**

**Column 2: Phone**
1. Click **+** to add new field
2. Name: `Phone`
3. Type: **Single line text**
4. Click **Save field**

**Column 3: Business**
1. Click **+** to add new field
2. Name: `Business`
3. Type: **Single line text**
4. Click **Save field**

**Column 4: Type**
1. Click **+** to add new field
2. Name: `Type`
3. Type: **Single line text** (default value: "Missed Call")
4. Click **Save field**

**Column 5: Status**
1. Click **+** to add new field
2. Name: `Status`
3. Type: **Single select**
4. Add options:
   - `Texted`
   - `Pending`
   - `Failed`
   - `Responded`
5. Click **Save field**

**Column 6: MissedAt**
1. Click **+** to add new field
2. Name: `MissedAt`
3. Type: **Date** (with time)
4. Click **Save field**

**Column 7: Response** (optional)
1. Click **+** to add new field
2. Name: `Response`
3. Type: **Long text**
4. Click **Save field**

### Final Table Structure

| Name | Timestamp | Phone | Business | Type | Status | MissedAt | Response |
|------|---|---|---|---|---|---|---|
| Unknown | 2024-01-15 10:30 | +1555... | Acme | Missed Call | Texted | 2024-01-15 10:29 | (empty) |

---

## Step 3: Create Table 2 - Leads

### Create the Table

1. Click **Add a table** or **+ Add**
2. Name it: `Leads`
3. Click **Create table**

### Add Columns

**Column 1: Timestamp**
1. Click **+** to add new field
2. Name: `Timestamp`
3. Type: **Date** (with time)
4. Click **Save field**

**Column 2: Phone**
1. Click **+** to add new field
2. Name: `Phone`
3. Type: **Single line text**
4. Click **Save field**

**Column 3: Business**
1. Click **+** to add new field
2. Name: `Business`
3. Type: **Single line text**
4. Click **Save field**

**Column 4: Service**
1. Click **+** to add new field
2. Name: `Service`
3. Type: **Single line text** (what service they're requesting)
4. Click **Save field**

**Column 5: Type**
1. Click **+** to add new field
2. Name: `Type`
3. Type: **Single line text** (default: "Lead Submission")
4. Click **Save field**

**Column 6: Status**
1. Click **+** to add new field
2. Name: `Status`
3. Type: **Single select**
4. Add options:
   - `Texted`
   - `Pending`
   - `Failed`
   - `Responded`
5. Click **Save field**

**Column 7: Response** (optional)
1. Click **+** to add new field
2. Name: `Response`
3. Type: **Long text**
4. Click **Save field**

### Final Table Structure

| Name | Timestamp | Phone | Business | Service | Type | Status | Response |
|------|---|---|---|---|---|---|---|
| John Doe | 2024-01-15 10:35 | +1555... | Acme | Plumbing | Lead | Texted | (empty) |

---

## Step 4: Get Your Airtable API Credentials

### Get API Key

1. Go to [Airtable Account](https://airtable.com/account/tokens)
2. Click **Create token** or **Generate new token**
3. Name it: `Missed Call System`
4. Scopes needed: `data.records:read`, `data.records:write`, `schema.bases:read`
5. Click **Create token**
6. **COPY THE TOKEN** (you'll only see it once!)

**Example:**
```
pat1234567890abcdefghijklmnopqrstuvwxyz
```

### Get Base ID

1. Go to your base: [https://airtable.com/bases](https://airtable.com/bases)
2. Click on your base
3. Look at the URL. It will be something like:
   ```
   https://airtable.com/app1234567890abcd
   ```
4. The part after `app` is your Base ID: `1234567890abcd`

**Alternatively:**
1. In your base, click the **? (Help)** icon
2. Select **API documentation**
3. Your Base ID is shown at the top

**Example:**
```
appXXXXXXXXXXXXXX
```

### Get Table IDs

1. In the API documentation (from above), scroll to **List Records**
2. You'll see table names with their IDs
3. Look for:
   - `Missed Calls` table ID (something like `tblXXXXXXXXXXXXXX`)
   - `Leads` table ID (something like `tblYYYYYYYYYYYYYY`)

**Write them down:**
```
Missed Calls Table ID: tblXXXXXXXXXXXXXX
Leads Table ID: tblYYYYYYYYYYYYYY
```

---

## Step 5: Update Environment Variables

Add your Airtable credentials to `.env.local`:

```bash
# Airtable Configuration
AIRTABLE_API_KEY=pat1234567890abcdefghijklmnopqrstuvwxyz
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
AIRTABLE_MISSED_CALLS_TABLE_ID=tblXXXXXXXXXXXXXX
AIRTABLE_LEADS_TABLE_ID=tblYYYYYYYYYYYYYY
```

**Save the file!**

---

## Step 6: Test Airtable Integration (Local)

### Test 1: Seed Test Businesses

```bash
npm run seed:test-businesses
```

### Test 2: Start Dev Server

```bash
npm run dev
```

### Test 3: Submit Test Lead

```bash
curl -X POST http://localhost:3000/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "phone": "+15551234567",
    "serviceRequested": "Plumbing Repair",
    "businessId": 1
  }'
```

**Expected response:**
```json
{
  "success": true,
  "recordId": 42,
  "textSent": true
}
```

### Test 4: Check Airtable

1. Go to your Airtable base
2. Click on the **Leads** table
3. You should see a new record:

| Name | Timestamp | Phone | Business | Service | Status |
|------|---|---|---|---|---|
| John Doe | 2024-01-15 10:35 | +15551234567 | (should appear) | Plumbing Repair | Texted |

**What this proves:**
- ✅ API key is valid
- ✅ Base ID is correct
- ✅ Table ID is correct
- ✅ Data is writing to Airtable

### Test 5: Test Missed Call Logging

```bash
# Let a call go to voicemail on your Twilio number
# Or simulate it:
curl -X POST http://localhost:3000/api/webhooks/twilio/call-status \
  -d "CallStatus=no-answer&From=%2B15551234567&CallSid=CA123&CallDuration=5"
```

### Test 6: Check Missed Calls Table

1. Go to your Airtable base
2. Click on the **Missed Calls** table
3. You should see a new record:

| Name | Timestamp | Phone | Business | Type | Status |
|------|---|---|---|---|---|
| Unknown | 2024-01-15 10:30 | +15551234567 | (should appear) | Missed Call | Texted |

**What this proves:**
- ✅ Missed call logging works
- ✅ Both tables are receiving data
- ✅ Airtable integration is complete

---

## Step 7: Deploy to Vercel

### Step 1: Commit Your Changes

```bash
git add .env.local
git commit -m "Add Airtable credentials"
git push origin claude/missed-call-textback-6a4nxe
```

### Step 2: Add Environment Variables to Vercel

1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your project
3. Click **Settings** → **Environment Variables**
4. Add these new variables:

| Name | Value |
|------|-------|
| AIRTABLE_API_KEY | pat1234567890... |
| AIRTABLE_BASE_ID | appXXXXXXXXXXXXXX |
| AIRTABLE_MISSED_CALLS_TABLE_ID | tblXXXXXXXXXXXXXX |
| AIRTABLE_LEADS_TABLE_ID | tblYYYYYYYYYYYYYY |

5. Click **Save**

### Step 3: Deploy

```bash
vercel deploy --prod
```

### Step 4: Test Production

1. Call your Twilio number
2. Let it go to voicemail
3. Wait 5 seconds
4. Go to Airtable
5. Refresh the **Missed Calls** table
6. You should see the record (it may take a few seconds)

---

## Troubleshooting Airtable

### Problem: "API key invalid"

**Fix:**
1. Go to [Airtable Tokens](https://airtable.com/account/tokens)
2. Verify your token hasn't expired
3. Create a new token if needed
4. Copy and update in `.env.local`

### Problem: "Base not found"

**Fix:**
1. Verify Base ID is correct
2. Copy from URL: `https://airtable.com/appXXXXXXXXXXXXXX`
3. The `XXXX` part is your Base ID
4. Update in `.env.local`

### Problem: "Table not found"

**Fix:**
1. In Airtable, click **?** → **API documentation**
2. Find your table in the sidebar
3. Look for "baseData.records" section
4. Copy the correct table ID
5. Update in `.env.local`

### Problem: "Records not appearing in Airtable"

**Checklist:**
- [ ] API key is valid (just created?)
- [ ] Base ID is correct
- [ ] Table IDs are correct
- [ ] Column names match exactly (`Timestamp`, `Phone`, etc.)
- [ ] Check server logs for errors

**Debug:**
```bash
# In dev server, look for:
# "Error logging to Airtable:"
# If you see this, the error message will follow
```

### Problem: "Column not found"

**Issue:** Column names don't match what the code expects

**Fix:**
1. Go to Airtable
2. Check column names exactly match:
   - `Timestamp` (capital T)
   - `Phone` (capital P)
   - `Business` (capital B)
   - `Type` (capital T)
   - `Status` (capital S)
3. Rename if needed

---

## Advanced: View Your Data

### Create a Dashboard View

1. In Airtable, go to **Missed Calls** table
2. Click **+ Add a view**
3. Select **Calendar** (to see by date)
4. Or select **Grid** to see as spreadsheet

### Filter by Status

1. Click **Filter**
2. Add filter: `Status` **is** `Texted`
3. Now you see only successful texts

### Group by Business

1. Click **Group**
2. Select **Group by** → `Business`
3. Now records are organized by business

---

## Verification Checklist

```
AIRTABLE SETUP
☐ Base created
☐ "Missed Calls" table created with correct columns
☐ "Leads" table created with correct columns
☐ API token generated and saved
☐ Base ID copied
☐ Table IDs copied

LOCAL TESTING
☐ .env.local has all 4 Airtable variables
☐ npm run dev starts
☐ Submit test lead via curl
☐ Record appears in Airtable Leads table
☐ Simulate missed call
☐ Record appears in Airtable Missed Calls table

PRODUCTION
☐ Environment variables added to Vercel
☐ Vercel deployment successful
☐ Test with real Twilio call
☐ Records appear in Airtable within 10 seconds
☐ Both tables receiving data
```

---

## Quick Reference

### Airtable Links
- [Airtable Home](https://airtable.com)
- [API Tokens](https://airtable.com/account/tokens)
- [API Documentation](https://airtable.com/api)

### Expected Data Structure

**Missed Calls Table:**
- Creates automatically when call is missed
- Phone: Caller's number
- Business: Business name (from config)
- Status: "Texted" (if SMS sent), "Failed", "Pending"
- Timestamp: Current time

**Leads Table:**
- Creates automatically when lead form submitted
- Phone: Lead's number
- Name: Lead's name
- Business: Business name (from config)
- Service: Service they requested
- Status: "Texted" (if SMS sent)
- Timestamp: Current time

---

**Status: Airtable Setup Complete ✅**

All missed calls and leads are now being logged. Next: Set up email alerts.
