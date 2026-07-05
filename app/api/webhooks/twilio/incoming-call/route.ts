import { NextRequest, NextResponse } from 'next/server';
import { generateMissedCallTwiML, verifyTwilioSignature } from '@/app/lib/twilio';
import { loadBusinessConfig } from '@/app/lib/config';

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

    // Load business config (in multi-tenant setup, could extract businessId from query param)
    const config = await loadBusinessConfig();

    // Extract caller info
    const from = paramsObj.From || '';
    const callSid = paramsObj.CallSid || '';

    console.log(`Incoming call from ${from}, CallSid: ${callSid}`);

    // Generate TwiML response with voicemail
    const twiml = generateMissedCallTwiML();

    // Set webhook for call completion
    // (Twilio will POST to /api/webhooks/twilio/call-status when call completes)

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
