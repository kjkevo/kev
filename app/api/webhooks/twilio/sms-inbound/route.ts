import { NextRequest, NextResponse } from 'next/server';
import { verifyTwilioSignature, sendSMS } from '@/app/lib/twilio';
import { prisma } from '@/app/lib/db';
import { loadBusinessConfig } from '@/app/lib/config';
import { logSmsResponseToAirtable } from '@/app/lib/airtable';
import { generateTextReply, aiConfigured, agentContextFrom } from '@/app/lib/ai';
import { detectEmergency } from '@/app/lib/emergency';
import { sendEmergencyAlertToOwner } from '@/app/lib/notifications';

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
    const to = paramsObj.To || '';
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

    // ─── Emergency escalation + conversational Text AI ───────────────────────
    // Skip carrier keywords (STOP/HELP/etc). Otherwise, for an active texting
    // business: (1) if the message looks like an emergency, alert the owner
    // immediately — regardless of whether AI replies are on; (2) if AI text is
    // on, answer the message grounded in their setup.
    const KEYWORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'START', 'UNSTOP', 'YES', 'HELP', 'INFO']);
    const isKeyword = KEYWORDS.has(messageBody.trim().toUpperCase());

    if (!isKeyword && to) {
      const biz = await prisma.businessConfig.findFirst({ where: { businessPhone: to } });
      if (biz && biz.active && biz.smsEnabled) {
        const details = biz.signupId != null
          ? (((await prisma.trialSignup.findUnique({ where: { id: biz.signupId } }))?.onboardingDetails as Record<string, string> | null) || {})
          : {};

        // (1) Emergency → notify the owner right away (SMS + email).
        if (detectEmergency(messageBody, details.emergencyNotify)) {
          await sendEmergencyAlertToOwner(
            { phone: details.personalPhone || biz.ownerPhone, email: details.personalEmail || biz.ownerEmail },
            biz.businessName,
            { customerPhone: from, message: messageBody, channel: 'text' },
          ).catch((e) => console.error('Emergency alert failed:', e));
        }

        // (2) Conversational AI reply (only if enabled + configured).
        if (aiConfigured && biz.aiTextEnabled) {
          // Loop guard: cap AI replies per contact per hour.
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
          const recentOut = await prisma.conversationMessage.count({
            where: { businessId: biz.id, contactPhone: from, role: 'outbound', createdAt: { gt: hourAgo } },
          });
          if (recentOut < 15) {
            const history = await prisma.conversationMessage.findMany({
              where: { businessId: biz.id, contactPhone: from },
              orderBy: { createdAt: 'asc' },
              take: 16,
            });
            await prisma.conversationMessage.create({
              data: { businessId: biz.id, contactPhone: from, channel: 'sms', role: 'inbound', body: messageBody },
            });
            const { reply } = await generateTextReply(
              { ...agentContextFrom(biz, details), recentMissedCall: Boolean(missedCall) },
              history.map((h) => ({ role: h.role as 'inbound' | 'outbound', body: h.body })),
              messageBody,
            );
            if (reply) {
              await sendSMS(from, reply, to).catch((e) => console.error('AI reply send failed:', e));
              await prisma.conversationMessage.create({
                data: { businessId: biz.id, contactPhone: from, channel: 'sms', role: 'outbound', body: reply },
              });
            }
          }
        }
      }
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
