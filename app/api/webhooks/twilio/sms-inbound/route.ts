import { NextRequest, NextResponse } from 'next/server';
import { verifyTwilioSignature } from '@/app/lib/twilio';
import { prisma } from '@/app/lib/db';
import { loadBusinessConfig } from '@/app/lib/config';
import { logSmsResponseToAirtable } from '@/app/lib/airtable';

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

    const from = paramsObj.From || '';
    const messageBody = paramsObj.Body || '';
    const messageSid = paramsObj.MessageSid || '';

    console.log(`Inbound SMS from ${from}: "${messageBody}" (SID: ${messageSid})`);

    // Try to find matching missed call or lead submission
    const missedCall = await prisma.missedCall.findFirst({
      where: {
        callerPhone: from,
        textStatus: 'sent',
        textResponse: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    const leadSubmission = await prisma.leadSubmission.findFirst({
      where: {
        phone: from,
        textStatus: 'sent',
        textResponse: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    // Update whichever record we found (prefer most recent)
    if (missedCall) {
      await prisma.missedCall.update({
        where: { id: missedCall.id },
        data: {
          textResponse: messageBody,
        },
      });

      // Try to update Airtable if configured
      if (missedCall.airtableId) {
        const config = await loadBusinessConfig(missedCall.businessId);
        const airtableConfig = {
          apiKey: config.airtableApiKey || '',
          baseId: config.airtableBaseId || '',
          tableId: config.airtableMissedTable || '',
        };
        await logSmsResponseToAirtable(airtableConfig, missedCall.airtableId, messageBody).catch(console.error);
      }

      console.log(`Updated missed call ${missedCall.id} with response`);
    } else if (leadSubmission) {
      await prisma.leadSubmission.update({
        where: { id: leadSubmission.id },
        data: {
          textResponse: messageBody,
        },
      });

      // Try to update Airtable if configured
      if (leadSubmission.airtableId) {
        const config = await loadBusinessConfig(leadSubmission.businessId);
        const airtableConfig = {
          apiKey: config.airtableApiKey || '',
          baseId: config.airtableBaseId || '',
          tableId: config.airtableLeadsTable || '',
        };
        await logSmsResponseToAirtable(airtableConfig, leadSubmission.airtableId, messageBody).catch(console.error);
      }

      console.log(`Updated lead submission ${leadSubmission.id} with response`);
    } else {
      console.warn(`No matching record found for phone ${from}`);
    }

    // Return empty TwiML to confirm receipt to Twilio (no reply message sent)
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  } catch (error) {
    console.error('Error handling inbound SMS:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
