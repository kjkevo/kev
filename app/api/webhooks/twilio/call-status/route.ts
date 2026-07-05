import { NextRequest, NextResponse } from 'next/server';
import { verifyTwilioSignature } from '@/app/lib/twilio';
import { loadBusinessConfig, validateConfig } from '@/app/lib/config';
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
    const callSid = paramsObj.CallSid || '';
    const duration = parseInt(paramsObj.CallDuration || '0', 10);

    console.log(`Call ${callSid} status: ${callStatus}, duration: ${duration}s, from: ${from}`);

    // Only process if call was not answered (missed) or went to voicemail
    if (callStatus !== 'completed' && callStatus !== 'no-answer') {
      return NextResponse.json({ success: true });
    }

    // If call was answered and lasted > 20 seconds, it's not a missed call
    if (duration > 20 && callStatus === 'completed') {
      return NextResponse.json({ success: true });
    }

    // Load business config
    const config = await loadBusinessConfig();
    const configErrors = validateConfig(config);
    if (configErrors.length > 0) {
      console.error('Invalid config:', configErrors);
      return NextResponse.json({ error: 'Invalid config' }, { status: 500 });
    }

    // Send automatic text to caller
    const textResult = await sendMissedCallText(from, config.businessName, config.missedCallMessage);

    // Log to database
    const missedCall = await prisma.missedCall.create({
      data: {
        businessId: config.id,
        callerPhone: from,
        missedAt: new Date(),
        textSentAt: textResult.success ? new Date() : undefined,
        textStatus: textResult.success ? 'sent' : 'failed',
        twilio_call_sid: callSid,
      },
    });

    // Log to Airtable
    const airtableConfig = {
      apiKey: config.airtableApiKey || '',
      baseId: config.airtableBaseId || '',
      tableId: config.airtableMissedTable || '',
    };

    const airtableId = await logMissedCallToAirtable(airtableConfig, {
      businessName: config.businessName,
      callerPhone: from,
      missedAt: new Date().toISOString(),
      textSent: textResult.success,
    });

    if (airtableId) {
      await prisma.missedCall.update({
        where: { id: missedCall.id },
        data: { airtableId },
      });
    }

    // Send email alert to owner (optional, don't fail if it errors)
    await sendMissedCallAlertToOwner(config.ownerEmail, config.businessName, {
      phone: from,
      time: new Date(),
    });

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
