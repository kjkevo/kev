import { NextRequest, NextResponse } from 'next/server';
import { generateMissedCallTwiML, generateTextOnlyTwiML, generateVoiceMenuTwiML, verifyTwilioSignature } from '@/app/lib/twilio';
import { loadBusinessConfigByPhone, renderTemplate } from '@/app/lib/config';
import { parseVoiceMenu, voiceMenuHints } from '@/app/lib/voiceMenu';

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
    //  - Voice + keyword menu -> ask what service they need and listen.
    //  - Voice (no menu) -> speak the custom greeting (and optionally voicemail).
    //  - Text-only / unknown -> end the call so the status webhook texts back.
    // Shut-off gate: a disabled business gets the plain text-only response
    // (which does nothing, since the status webhook is gated too).
    const active = config?.active !== false;
    const menu = active && config?.voiceEnabled ? parseVoiceMenu(config.voiceMenu) : null;

    let twiml: string;
    if (active && config?.voiceEnabled && menu) {
      const origin = new URL(request.url).origin;
      const prompt = renderTemplate(menu.prompt, { BUSINESS_NAME: config.businessName });
      twiml = generateVoiceMenuTwiML({
        prompt,
        hints: voiceMenuHints(menu),
        actionUrl: `${origin}/api/webhooks/twilio/voice-gather`,
      });
    } else if (active && config?.voiceEnabled) {
      twiml = generateMissedCallTwiML({
        greeting: config.voiceGreeting,
        recordVoicemail: config.recordVoicemail,
      });
    } else {
      twiml = generateTextOnlyTwiML();
    }

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
