import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { voiceSystemPrompt, voiceFirstMessage } from '@/app/lib/ai';
import { detectEmergency } from '@/app/lib/emergency';
import { sendEmergencyAlertToOwner } from '@/app/lib/notifications';

export const dynamic = 'force-dynamic';

// POST /api/webhooks/vapi — server events from Vapi for the live Voice AI.
//  - 'assistant-request' (inbound call): return the grounded voice agent for the
//    business that owns the called number.
//  - 'end-of-call-report': save the call summary/transcript into the shared
//    ConversationMessage memory (channel 'voice') so the Text AI can relay to it.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const message = body?.message ?? {};
  const type: string = message?.type ?? '';

  const calledNumber: string =
    message?.phoneNumber?.number || message?.call?.phoneNumber?.number || '';
  const callerNumber: string =
    message?.customer?.number || message?.call?.customer?.number || '';

  if (type === 'assistant-request') {
    const biz = calledNumber
      ? await prisma.businessConfig.findFirst({ where: { businessPhone: calledNumber } })
      : null;
    if (!biz) return NextResponse.json({ error: 'No business for this number.' }, { status: 200 });

    const details = biz.signupId != null
      ? (((await prisma.trialSignup.findUnique({ where: { id: biz.signupId } }))?.onboardingDetails as Record<string, string> | null) || {})
      : {};
    const transferNumber = details.personalPhone || biz.ownerPhone || null;

    const system = voiceSystemPrompt(
      {
        businessName: biz.businessName,
        industry: details.industry,
        hours: details.hours,
        services: details.services,
        notOffered: details.notOffered,
        faqs: details.faqs,
        emergency: details.emergencyNotify,
        tone: details.tone,
        website: details.websiteUrl,
      },
      { transferNumber },
    );

    // Missed-call opener + two-party-consent (Illinois) AI + recording disclosure.
    const firstMessage = voiceFirstMessage(biz.businessName);

    // The business's chosen voice is an ElevenLabs voice id (what Vapi speaks).
    const voice = biz.voice ? { provider: '11labs', voiceId: biz.voice } : { provider: 'vapi', voiceId: 'Elliot' };

    const overrides = {
      firstMessage,
      model: { messages: [{ role: 'system', content: system }] },
      voice,
    };

    // Optional: a base assistant configured once in the Vapi dashboard, overridden
    // per-business here. Otherwise build the whole agent inline.
    const assistantId = process.env.VAPI_ASSISTANT_ID;
    if (assistantId) {
      return NextResponse.json({ assistantId, assistantOverrides: overrides });
    }
    return NextResponse.json({
      assistant: {
        firstMessage,
        model: { provider: 'anthropic', model: 'claude-3-5-haiku-20241022', messages: [{ role: 'system', content: system }] },
        voice,
      },
    });
  }

  if (type === 'end-of-call-report') {
    const biz = calledNumber
      ? await prisma.businessConfig.findFirst({ where: { businessPhone: calledNumber } })
      : null;
    const summary: string = message?.analysis?.summary || message?.summary || '';
    const transcript: string = message?.artifact?.transcript || message?.transcript || '';
    const note = summary || (transcript ? `Call transcript:\n${transcript}` : '');
    if (biz && callerNumber && note) {
      await prisma.conversationMessage.create({
        data: { businessId: biz.id, contactPhone: callerNumber, channel: 'voice', role: 'inbound', body: note.slice(0, 4000) },
      }).catch(() => {});

      // If the call looks like an emergency, escalate to the owner right away.
      const details = biz.signupId != null
        ? (((await prisma.trialSignup.findUnique({ where: { id: biz.signupId } }))?.onboardingDetails as Record<string, string> | null) || {})
        : {};
      if (detectEmergency(`${summary}\n${transcript}`, details.emergencyNotify)) {
        await sendEmergencyAlertToOwner(
          { phone: details.personalPhone || biz.ownerPhone, email: details.personalEmail || biz.ownerEmail },
          biz.businessName,
          { customerPhone: callerNumber, message: summary || transcript, channel: 'voice' },
        ).catch((e) => console.error('Emergency alert (voice) failed:', e));
      }
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
