import { NextRequest, NextResponse } from 'next/server';
import { verifyTwilioSignature } from '@/app/lib/twilio';
import { loadBusinessConfigByPhone } from '@/app/lib/config';
import { sendMissedCallText, sendTextFailureAlertToOwner } from '@/app/lib/notifications';
import { prisma } from '@/app/lib/db';
import { Prisma } from '@prisma/client';

const HANGUP = '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>';
const xml = (body: string) => new NextResponse(body, { status: 200, headers: { 'Content-Type': 'application/xml' } });

// POST /api/webhooks/twilio/dial-status — Model B. Fires after we ring the
// owner's own phone (see incoming-call). If they answered, do nothing. If they
// missed it, text the caller back. Claims the call by CallSid first so the
// separate call-status webhook can't also send a duplicate text.
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

    const from = paramsObj.From || '';           // original caller
    const to = paramsObj.To || '';               // the Slimpse number
    const callSid = paramsObj.CallSid || '';
    const dialStatus = paramsObj.DialCallStatus || '';
    const answered = dialStatus === 'completed';

    const config = await loadBusinessConfigByPhone(to);
    if (!config || config.active === false) return xml(HANGUP);

    // Claim the call so call-status can't double-process it.
    try {
      await prisma.missedCall.create({
        data: {
          businessId: config.id,
          callerPhone: from,
          missedAt: new Date(),
          textStatus: answered ? 'answered' : (config.smsEnabled ? 'pending' : 'skipped'),
          twilio_call_sid: callSid || undefined,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return xml(HANGUP); // already handled
      }
      throw err;
    }

    // Owner picked up — nothing more to do.
    if (answered) return xml(HANGUP);

    // Owner missed it — text the caller back.
    if (config.smsEnabled) {
      const result = await sendMissedCallText(from, config.businessName, config.missedCallMessage, config.businessPhone, config.recordVoicemail);
      await prisma.missedCall.updateMany({
        where: { businessId: config.id, callerPhone: from, twilio_call_sid: callSid || undefined },
        data: { textSentAt: result.success ? new Date() : null, textStatus: result.success ? 'sent' : 'failed', textBody: result.body ?? null },
      });
      if (!result.success) {
        sendTextFailureAlertToOwner(
          { email: config.ownerEmail, phone: config.ownerPhone },
          config.businessName,
          { customerPhone: from, kind: 'missed_call', error: result.error },
        ).catch(() => {});
      }
    }

    return xml(HANGUP);
  } catch (error) {
    console.error('Error handling dial status:', error);
    return xml(HANGUP);
  }
}
