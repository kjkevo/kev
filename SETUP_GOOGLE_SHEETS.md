# Google Sheets Setup Guide - Alternative to Airtable

This guide walks you through setting up Google Sheets to log all missed calls and leads (alternative to Airtable).

**Alternative:** If you prefer Airtable, see [SETUP_AIRTABLE.md](SETUP_AIRTABLE.md)

---

## ✅ Prerequisites

- [ ] Google account created
- [ ] Google Sheets project created
- [ ] Google Cloud project created (for API credentials)
- [ ] Basic understanding of Google Sheets and Google Cloud Console

---

## Why Google Sheets vs Airtable?

| Feature | Google Sheets | Airtable |
|---------|---|---|
| **Cost** | Free | Free + paid plans |
| **Ease of setup** | Medium (requires Google Cloud) | Easy |
| **API simplicity** | Medium | Simple |
| **Collaboration** | Excellent (built for it) | Good |
| **Automation** | Good (Apps Script) | Excellent (automations) |
| **Speed** | Good | Fast |
| **Recommended for** | Teams, collaboration | Simple logging, quick setup |

**Recommendation:** Use Airtable for easier setup. Use Google Sheets if you already use Google Workspace or need built-in collaboration.

---

## Step 1: Create Google Sheets

### Step 1A: Create New Spreadsheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Click **+ Create new spreadsheet**
3. Name it: `Missed Call Automation` (or your preference)
4. Click **Create**

### Step 1B: Get Spreadsheet ID

Look at the URL:
```
https://docs.google.com/spreadsheets/d/1AB2CD3EF4GH5IJ6KL7MN8OP9QR0ST/edit
                                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                      This is your Spreadsheet ID
```

**Write it down:**
```
GOOGLE_SHEETS_ID=1AB2CD3EF4GH5IJ6KL7MN8OP9QR0ST
```

---

## Step 2: Create Sheet Tabs

### Step 2A: Create "Missed Calls" Tab

1. In your spreadsheet, click the **+** icon at bottom
2. Name it: `Missed Calls`
3. Press **Enter**

**Add column headers:**
```
Row 1:
A: Timestamp
B: Phone
C: Business
D: Type
E: Status
F: MissedAt
G: Response
H: CallerName
```

**Click on A1, type "Timestamp", press Tab, repeat for each header**

**Example:**
| Timestamp | Phone | Business | Type | Status | MissedAt | Response | CallerName |
|---|---|---|---|---|---|---|---|
| 2024-01-15 10:30 | +15551234567 | Acme Plumbing | Missed Call | Texted | 2024-01-15 10:29 | | Unknown |

### Step 2B: Create "Leads" Tab

1. Click the **+** icon again
2. Name it: `Leads`

**Add column headers:**
```
Row 1:
A: Timestamp
B: Phone
C: Name
D: Business
E: Service
F: Type
G: Status
H: Response
```

**Example:**
| Timestamp | Phone | Name | Business | Service | Type | Status | Response |
|---|---|---|---|---|---|---|---|
| 2024-01-15 10:35 | +15551234567 | John Doe | Acme Plumbing | Plumbing Repair | Lead | Texted | |

---

## Step 3: Set Up Google Cloud Project

This step gives the app permission to write to your Google Sheets.

### Step 3A: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click the project dropdown (top left)
3. Click **NEW PROJECT**
4. Name it: `Missed Call Logging`
5. Click **CREATE**
6. Wait for project to be created (1-2 minutes)

### Step 3B: Enable Sheets API

1. In Google Cloud Console, search for **Sheets API**
2. Click **Google Sheets API**
3. Click **ENABLE**

### Step 3C: Create Service Account

1. In Google Cloud Console, click **Credentials** (left sidebar)
2. Click **+ CREATE CREDENTIALS**
3. Select **Service Account**
4. Fill in:
   - **Service account name:** `missed-call-bot`
   - **Service account ID:** (auto-filled)
5. Click **CREATE AND CONTINUE**
6. Skip optional steps, click **DONE**

### Step 3D: Create and Download Key

1. In Credentials page, find your service account
2. Click on it
3. Click **KEYS** tab
4. Click **ADD KEY** → **Create new key**
5. Select **JSON**
6. Click **CREATE**
7. A JSON file downloads - **SAVE THIS FILE**

**The file contains your API credentials. Keep it safe!**

---

## Step 4: Share Spreadsheet with Service Account

### Step 4A: Find Service Account Email

1. Open the downloaded JSON file in a text editor
2. Find the line: `"client_email": "...@...iam.gserviceaccount.com"`
3. **Copy the entire email**

**Example:**
```
missed-call-bot@missed-call-logging.iam.gserviceaccount.com
```

### Step 4B: Share Spreadsheet

1. Go to your Google Sheets spreadsheet
2. Click **Share** (top right)
3. Paste the service account email
4. Select **Editor** (permissions)
5. Click **Share**
6. You'll see a warning about sharing with a service account - click **Share anyway**

---

## Step 5: Add Google Sheets Configuration

### Step 5A: Extract Credentials from JSON File

Open the downloaded JSON file and copy these values:

```json
{
  "type": "service_account",
  "project_id": "missed-call-logging",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "missed-call-bot@missed-call-logging.iam.gserviceaccount.com",
  "client_id": "123456789...",
  ...
}
```

**You need:**
- `private_key` (multiline string starting with -----BEGIN)
- `client_email`
- `project_id`

### Step 5B: Update .env.local

Add to your `.env.local`:

```bash
# Google Sheets Configuration
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SHEETS_ID=YOUR_SPREADSHEET_ID
GOOGLE_SHEETS_CLIENT_EMAIL=missed-call-bot@missed-call-logging.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_PROJECT_ID=missed-call-logging
```

**For the private_key:** Copy the entire value from JSON, keeping the newlines (\n).

**Important:** The private_key is sensitive - don't commit to git!

---

## Step 6: Update Code to Use Google Sheets

### Option A: Add Google Sheets Support (Recommended)

Update `app/lib/notifications.ts` to log to Google Sheets in addition to database.

**Add this function:**
```typescript
async function logToGoogleSheets(
  sheetName: string,
  data: Record<string, string>
) {
  if (!process.env.GOOGLE_SHEETS_ENABLED) {
    return; // Google Sheets disabled
  }

  try {
    const { GoogleSpreadsheet } = require('google-spreadsheet');
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID);

    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY,
    });

    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[sheetName];

    await sheet.addRow(data);
    console.log(`Logged to Google Sheets: ${sheetName}`);
  } catch (error) {
    console.error('Error logging to Google Sheets:', error);
  }
}
```

### Option B: Use Airtable Instead (Simpler)

Google Sheets requires more complex setup. Consider using Airtable if possible (see SETUP_AIRTABLE.md).

---

## Step 7: Install Google Sheets Package

```bash
npm install google-spreadsheet
npm install --save-dev @types/google-spreadsheet
```

---

## Step 8: Test Google Sheets Integration (Local)

### Test 1: Start Dev Server

```bash
npm run dev
```

### Test 2: Submit Test Lead

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

### Test 3: Check Server Logs

Look for:
```
Logged to Google Sheets: Leads
```

### Test 4: Check Google Sheets

1. Go to your Google Sheets spreadsheet
2. Click **Leads** tab
3. Refresh the page (Cmd+R)
4. You should see new row:

| Timestamp | Phone | Name | Business | Service | Type | Status |
|---|---|---|---|---|---|---|
| 2024-01-15 10:30 | +15551234567 | John Doe | Acme Plumbing | Plumbing Repair | Lead | Texted |

**What this proves:**
- ✅ Service account authenticated
- ✅ Spreadsheet accessible
- ✅ Data writing successfully
- ✅ Google Sheets integration working

---

## Step 9: Deploy to Vercel

### Step 1: Commit Changes

```bash
git add .env.local
git commit -m "Add Google Sheets integration"
git push origin claude/missed-call-textback-6a4nxe
```

### Step 2: Add Environment Variables to Vercel

1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your project
3. Click **Settings** → **Environment Variables**
4. Add these variables:

| Name | Value |
|------|-------|
| GOOGLE_SHEETS_ENABLED | true |
| GOOGLE_SHEETS_ID | YOUR_SPREADSHEET_ID |
| GOOGLE_SHEETS_CLIENT_EMAIL | missed-call-bot@... |
| GOOGLE_SHEETS_PRIVATE_KEY | -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n |
| GOOGLE_SHEETS_PROJECT_ID | missed-call-logging |

5. Click **Save**

### Step 3: Deploy

```bash
vercel deploy --prod
```

### Step 4: Test Production

1. Submit test lead to production URL
2. Check Google Sheets for new row
3. Should appear within 5 seconds

---

## Troubleshooting Google Sheets

### Problem: "Access denied" or "Permission denied"

**Fix:**
1. Make sure you shared the spreadsheet with the service account email
2. Verify service account email in .env.local is correct
3. Regenerate service account key and try again

### Problem: "Spreadsheet not found"

**Fix:**
1. Verify GOOGLE_SHEETS_ID is correct
2. Copy from URL: `https://docs.google.com/spreadsheets/d/YOUR_ID/edit`
3. Verify in .env.local

### Problem: "Invalid private_key"

**Fix:**
1. Make sure private_key has full content (starts with -----BEGIN)
2. Make sure newlines are preserved (\n)
3. Don't add extra quotes around the key
4. Regenerate key from Google Cloud Console

### Problem: "Rows not appearing in Google Sheets"

**Checklist:**
- [ ] Column headers match exactly (case-sensitive)
- [ ] Service account has Editor access
- [ ] GOOGLE_SHEETS_ENABLED=true in environment
- [ ] Check server logs for errors
- [ ] Refresh Google Sheets (Cmd+R)

**Debug:**
```bash
# In dev server logs, look for:
# "Logged to Google Sheets: Leads"
# Or: "Error logging to Google Sheets:"
```

---

## Comparison: Airtable vs Google Sheets

| Feature | Airtable | Google Sheets |
|---------|----------|---|
| **API Setup** | Simple (token-based) | Complex (OAuth2 + service account) |
| **Time to Setup** | 10 minutes | 30 minutes |
| **Cost** | Free tier available | Free |
| **Ease of Collaboration** | Good | Excellent (real-time) |
| **Query Capabilities** | Better | More limited |
| **Automation** | Better | Apps Script needed |
| **Mobile app** | Better | Good |
| **For this project** | Recommended | Works but more setup |

**Recommendation:** Unless you already use Google Sheets heavily, use Airtable (SETUP_AIRTABLE.md).

---

## Production Checklist

```
SETUP
☐ Google Sheets created
☐ Spreadsheet ID copied
☐ Google Cloud project created
☐ Sheets API enabled
☐ Service account created
☐ JSON key downloaded
☐ Spreadsheet shared with service account

CONFIGURATION
☐ .env.local has GOOGLE_SHEETS_* variables
☐ All four variables set correctly
☐ Private key has full content

LOCAL TESTING
☐ npm run dev starts
☐ Submit test lead via curl
☐ New row appears in Google Sheets Leads tab
☐ Missed call simulation logs to Missed Calls tab

PRODUCTION
☐ Environment variables added to Vercel
☐ Vercel deployment successful
☐ Submit test lead to production
☐ Row appears in Google Sheets within 5 seconds
```

---

## Quick Reference

### Spreadsheet ID
```
URL: https://docs.google.com/spreadsheets/d/ABC123/edit
ID:  ABC123
```

### Service Account Email
```
Format: name@project-id.iam.gserviceaccount.com
Example: missed-call-bot@missed-call-logging.iam.gserviceaccount.com
```

### Test
```bash
# Submit lead
curl -X POST http://localhost:3000/api/webhooks/lead-submission \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","phone":"+15551234567","serviceRequested":"Test","businessId":1}'

# Check logs
npm run dev | grep "Google Sheets"
```

---

## Next Steps

1. ✅ Set up Google Sheets (this guide)
2. Or use Airtable instead (simpler)
3. Deploy to Vercel or Railway
4. Test production logging
5. Monitor data in spreadsheet

---

## Helpful Links

- [Google Cloud Console](https://console.cloud.google.com)
- [Google Sheets API Docs](https://developers.google.com/sheets/api)
- [google-spreadsheet npm package](https://www.npmjs.com/package/google-spreadsheet)
- [Service Account Setup Guide](https://cloud.google.com/docs/authentication/getting-started)

---

**Status: Google Sheets Setup Complete ✅**

All missed calls and leads are now being logged to Google Sheets. If this is too complex, consider using Airtable instead (see SETUP_AIRTABLE.md).

