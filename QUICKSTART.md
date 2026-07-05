# Quick Start: Appointment Reminder Automation

Get the appointment reminder system running in **10 minutes**.

## 5-Minute Setup

### 1. Get Twilio Credentials (2 minutes)
- Go to https://www.twilio.com/console
- Sign up → get **Account SID**, **Auth Token**, and pick a **phone number**

### 2. Create Google Service Account (2 minutes)
- Go to https://console.cloud.google.com
- Create project → Enable Google Sheets API
- Create Service Account → Download JSON key

### 3. Create Google Sheet
- Go to https://sheets.google.com → New sheet
- Share with the service account email from JSON
- Copy the spreadsheet ID from the URL

### 4. Add Environment Variables

```bash
# Copy example and fill in your credentials
cp .env.example .env.local
```

Edit `.env.local`:
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1234567890

GOOGLE_SHEETS_SPREADSHEET_ID=1ABC123xxx
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nxxx\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_CLIENT_EMAIL=xxx@iam.gserviceaccount.com

APPOINTMENT_WEBHOOK_SECRET=your-secret-key
```

### 5. Copy Config

```bash
cp config/clients-example.ts config/clients.ts
# Edit config/clients.ts with your business details
```

## Run It

**Terminal 1: Next.js API**
```bash
npm run dev
```

**Terminal 2: Reminder Service**
```bash
npm run reminders:dev
```

**Terminal 3: Test**
```bash
ts-node scripts/test-webhooks.ts
```

That's it! 🎉

## API Endpoints

### Create Appointment
```bash
curl -X POST http://localhost:3000/api/webhooks/appointments \
  -H "Content-Type: application/json" \
  -H "x-appointment-signature: YOUR_SIGNATURE" \
  -d '{
    "clientId": "dental-office-1",
    "customerName": "John Doe",
    "customerPhone": "+15551234567",
    "appointmentDateTime": "2026-07-10T14:30:00Z",
    "serviceType": "Cleaning"
  }'
```

### Mark No-Show
```bash
curl -X POST http://localhost:3000/api/webhooks/no-show \
  -H "x-appointment-signature: YOUR_SIGNATURE" \
  -d '{
    "clientId": "dental-office-1",
    "appointmentId": "apt_xxx"
  }'
```

### Add to Waitlist
```bash
curl -X POST http://localhost:3000/api/webhooks/waitlist \
  -H "x-appointment-signature: YOUR_SIGNATURE" \
  -d '{
    "action": "add",
    "clientId": "dental-office-1",
    "customerName": "Jane Smith",
    "customerPhone": "+15559876543",
    "serviceType": "Cleaning"
  }'
```

## What You Get

✅ Instant confirmation texts  
✅ Automatic 24h & 2h reminders  
✅ No-show follow-ups with rebook link  
✅ Waitlist auto-notification  
✅ Per-client customizable messaging  
✅ Timezone-aware scheduling  
✅ ~$35–50/month all-in cost  

## For Details

- **Architecture & Integration**: See `APPOINTMENT_REMINDERS_README.md`
- **Step-by-Step Setup**: See `IMPLEMENTATION_GUIDE.md`
- **Configuration**: Edit `config/clients.ts`

## Need Help?

Check logs in your terminal for errors. Common issues:
- **SMS not sending**: Check Twilio balance (https://console.twilio.com)
- **Reminders not firing**: Make sure `npm run reminders:dev` is running
- **Sheets connection failing**: Verify service account is shared on the spreadsheet

For more details, see the full documentation.
