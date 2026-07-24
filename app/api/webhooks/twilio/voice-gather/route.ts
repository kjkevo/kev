import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { verifyTwilioSignature, generateSpokenReplyTwiML } from '@/app/lib/twilio';
import { loadBusinessConfigByPhone } from '@/app/lib/config';
import { parseVoiceMenu, matchVoiceMenu } from '@/app/lib/voiceMenu';
import { sendMissedCallText, sendTextFailureAlertToOwner } from '@/app/lib/notifications';
import { prisma } from '@/app/lib/db';

function xml(body: string) {
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'application/xml' } });
}

// Handles the caller's response to the keyword voice menu. Matches what they
// said (or keyed) to a service, sends a service-specific text-back, and speaks
// a reply. The MissedCall record is created here (claiming the CallSid), so the
// later call-status webhook dedupes and never sends a second text.
export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-twilio-signature') || '';
    const url = new URL(request.url).toString();
    const body = await request.text();
    const paramsObj = Object.fromEntries(new URLSearchParams(body));

    if (process.env.NODE_ENV === 'production') {
      if (!verifyTwilioSignature(url, paramsObj, signature)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
      }
    }

    const from = paramsObj.From || '';
    const to = paramsObj.To || '';
    const callSid = paramsObj.CallSid || '';
    const speech = paramsObj.SpeechResult || '';
    const digits = paramsObj.Digits || '';

    const config = await loadBusinessConfigByPhone(to);
    const menu = config ? parseVoiceMenu(config.voiceMenu) : null;

    // No business or no menu -> just end politely (shouldn't normally happen).
    if (!config || !menu) {
      return xml(generateSpokenReplyTwiML("Thanks for calling. We'll be in touch shortly."));
    }

    const match = matchVoiceMenu(menu, speech, digits);
    const spokenReply = match?.reply
      || menu.fallbackReply
      || "Thanks — we'll text you now to help with your request.";
    const smsTemplate = match?.sms
      || menu.fallbackSms
      || config.missedCallMessage;
    const serviceLabel = match?.label || 'unmatched';

    console.log(
      `Voice menu ${callSid}: heard="${speech}" digits="${digits}" -> ${serviceLabel}`,
    );

    // Claim this call by CallSid before texting, so a re-delivered webhook (or
    // the later call-status webhook) can't trigger a duplicate text-back.
    let claimed = true;
    try {
      await prisma.missedCall.create({
        data: {
          businessId: config.id,
          callerPhone: from,
          missedAt: new Date(),
          textStatus: config.smsEnabled ? 'pending' : 'skipped',
          twilio_call_sid: callSid || undefined,
          notes: match ? `Service (voice): ${match.label}` : 'Voice menu: no match',
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Already handled (e.g. duplicate gather delivery) — just speak back.
        claimed = false;
      } else {
        throw err;
      }
    }

    // Send the service-specific text-back exactly once (only on first claim).
    if (claimed && config.smsEnabled) {
      const textResult = await sendMissedCallText(
        from, config.businessName, smsTemplate, config.businessPhone, config.recordVoicemail,
      );
      await prisma.missedCall.update({
        where: { twilio_call_sid: callSid },
        data: {
          textSentAt: textResult.success ? new Date() : null,
          textStatus: textResult.success ? 'sent' : 'failed',
          textBody: textResult.body ?? null,
        },
      }).catch(console.error);

      if (!textResult.success) {
        sendTextFailureAlertToOwner(
          { email: config.ownerEmail, phone: config.ownerPhone },
          config.businessName,
          { customerPhone: from, kind: 'missed_call', error: textResult.error },
        ).catch(console.error);
      }
    }

    return xml(generateSpokenReplyTwiML(spokenReply));
  } catch (error) {
    console.error('Error handling voice gather:', error);
    return xml(generateSpokenReplyTwiML("Thanks for calling. We'll be in touch shortly."));
  }
}
