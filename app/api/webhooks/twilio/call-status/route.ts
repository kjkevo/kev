import { NextRequest, NextResponse } from 'next/server';
import { verifyTwilioSignature } from '@/app/lib/twilio';
import { loadBusinessConfigByPhone, validateConfig } from '@/app/lib/config';
import { sendMissedCallText, sendMissedCallAlertToOwner } from '@/app/lib/notifications';
import { logMissedCallToAirtable } from '@/app/lib/airtable';
import { prisma } from '@/app/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Verify Twilio request signature
    const signature = request.headers.get('x-twilio-signature') || '';
    const url = new URL(request.url).toString();
    const body = await request.text();
    const params = new URLSearchParams(body);
    const paramsObj = Object.fromEntries(params);

    if (process.env.NODE_ENV === 'production') {
      if (!verifyTwilioSignature(url, paramsObj, signature)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
      }
    }

    const callStatus = paramsObj.CallStatus || '';
    const from = paramsObj.From || '';
    const to = paramsObj.To || '';
    const callSid = paramsObj.CallSid || '';
    const duration = parseInt(paramsObj.CallDuration || '0', 10);

    console.log(`Call ${callSid} status: ${callStatus}, duration: ${duration}s, from: ${from}, to: ${to}`);

    // Only process if call was not answered (missed) or went to voicemail
    if (callStatus !== 'completed' && callStatus !== 'no-answer') {
      return NextResponse.json({ success: true });
    }

    // If call was answered and lasted > 20 seconds, it's not a missed call
    if (duration > 20 && callStatus === 'completed') {
      return NextResponse.json({ success: true });
    }

    // Multi-tenant routing: find the business by the number that was dialed
    const config = await loadBusinessConfigByPhone(to);
    if (!config) {
      console.warn(`No business configured for number ${to}; skipping.`);
      return NextResponse.json({ success: true, skipped: 'no business for number' });
    }
    const configErrors = validateConfig(config);
    if (configErrors.length > 0) {
      console.error('Invalid config:', configErrors);
      return NextResponse.json({ error: 'Invalid config' }, { status: 500 });
    }

    // Send automatic text to caller (from the business's own number), if enabled
    const textResult = config.smsEnabled
      ? await sendMissedCallText(from, config.businessName, config.missedCallMessage, config.businessPhone)
      : { success: false as const };

    // Log to database
    const missedCall = await prisma.missedCall.create({
      data: {
        businessId: config.id,
        callerPhone: from,
        missedAt: new Date(),
        textSentAt: textResult.success ? new Date() : undefined,
        textStatus: config.smsEnabled ? (textResult.success ? 'sent' : 'failed') : 'skipped',
        twilio_call_sid: callSid,
      },
    });

    // Log to Airtable (async, don't fail if it errors)
    const airtableConfig = {
      apiKey: config.airtableApiKey || '',
      baseId: config.airtableBaseId || '',
      tableId: config.airtableMissedTable || '',
    };

    logMissedCallToAirtable(airtableConfig, {
      businessName: config.businessName,
      callerPhone: from,
      missedAt: new Date().toISOString(),
      textSent: textResult.success,
    })
      .then((airtableId) => {
        if (airtableId) {
          prisma.missedCall.update({
            where: { id: missedCall.id },
            data: { airtableId },
          }).catch(console.error);
        }
      })
      .catch(console.error);

    // Send email alert to owner (optional, don't fail if it errors)
    sendMissedCallAlertToOwner(config.ownerEmail, config.businessName, {
      phone: from,
      time: new Date(),
    }).catch(console.error);

    console.log(`Processed missed call ${callSid}, text status: ${textResult.success ? 'sent' : 'failed'}`);

    return NextResponse.json({ success: true, recordId: missedCall.id });
  } catch (error) {
    console.error('Error handling call status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
