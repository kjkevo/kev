import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';
import { voiceSystemPrompt, voiceFirstMessage, agentContextFrom } from '@/app/lib/ai';
import { VOICE_OPTIONS } from '@/app/lib/voices';

export const dynamic = 'force-dynamic';

// GET /api/admin/businesses/[id]/vapi-setup — everything the operator needs to
// stand up this business's Voice AI in the Vapi dashboard by hand: the grounded
// System Prompt, the First Message (Illinois AI + recording disclosure), the
// Anthropic model, and the ElevenLabs voice the client picked. This is the SAME
// prompt our /api/webhooks/vapi returns for the dynamic path, so what you paste
// into a static Vapi assistant matches what the automated flow would build.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const biz = await prisma.businessConfig.findUnique({ where: { id } });
  if (!biz) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

  const details = biz.signupId != null
    ? (((await prisma.trialSignup.findUnique({ where: { id: biz.signupId } }))?.onboardingDetails as Record<string, string> | null) || {})
    : {};

  const transferNumber = details.personalPhone || biz.ownerPhone || null;

  const systemPrompt = voiceSystemPrompt(agentContextFrom(biz, details), { transferNumber });

  const firstMessage = voiceFirstMessage(biz.businessName);

  // The client's picked voice is an ElevenLabs voice id (what Vapi speaks with).
  const chosen = biz.voice ? VOICE_OPTIONS.find((v) => v.id === biz.voice) : null;

  // Use the real request origin so the Server URL shows the live domain (not a
  // stale localhost/env value) when pasted into Vapi.
  const appUrl = request.nextUrl.origin.replace(/\/$/, '');

  return NextResponse.json({
    businessName: biz.businessName,
    businessPhone: biz.businessPhone,
    voiceEnabled: biz.voiceEnabled,
    systemPrompt,
    firstMessage,
    model: { provider: 'Anthropic', name: 'claude-3-5-haiku-20241022' },
    voice: {
      provider: '11Labs',
      voiceId: chosen ? chosen.id : (biz.voice || null),
      label: chosen ? chosen.label : (biz.voice ? 'Custom ElevenLabs voice' : 'No voice picked yet — default'),
    },
    transferNumber,
    serverUrl: appUrl ? `${appUrl}/api/webhooks/vapi` : '/api/webhooks/vapi',
  });
}
