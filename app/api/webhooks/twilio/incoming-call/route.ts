import { NextRequest, NextResponse } from 'next/server';
import { generateMissedCallTwiML, generateTextOnlyTwiML, verifyTwilioSignature } from '@/app/lib/twilio';
import { loadBusinessConfigByPhone } from '@/app/lib/config';

export async function POST(request: NextRequest) {
  try {
    // Verify Twilio request signature
    const signature = request.headers.get('x-twilio-signature') || '';
    const url = new URL(request.url).toString();
    const body = await request.text();
    const params = new URLSearchParams(body);
    const paramsObj = Object.fromEntries(params);

    // Verify signature (optional in development, required in production)
    if (process.env.NODE_ENV === 'production') {
      if (!verifyTwilioSignature(url, paramsObj, signature)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
      }
    }

    // Extract call info
    const from = paramsObj.From || '';
    const to = paramsObj.To || '';
    const callSid = paramsObj.CallSid || '';

    // Multi-tenant routing: identify the business by the number that was dialed
    const config = await loadBusinessConfigByPhone(to);

    console.log(`Incoming call from ${from} to ${to} (${config?.businessName ?? 'unknown business'}), CallSid: ${callSid}`);

    // Choose the voice response based on the business's channel settings.
    // Voice enabled -> speak the custom greeting (and optionally take a voicemail).
    // Text-only / unknown -> end the call so the status webhook triggers the text-back.
    const twiml = config?.voiceEnabled
      ? generateMissedCallTwiML({
          greeting: config.voiceGreeting,
          recordVoicemail: config.recordVoicemail,
        })
      : generateTextOnlyTwiML();

    // Twilio will POST to /api/webhooks/twilio/call-status when the call ends,
    // where the text-back is sent.

    return new NextResponse(twiml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  } catch (error) {
    console.error('Error handling incoming call:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
