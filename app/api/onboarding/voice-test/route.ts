import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { isValidVoice } from '@/app/lib/voices';
import { placeSampleCall } from '@/app/lib/twilio';

export const dynamic = 'force-dynamic';

// POST /api/onboarding/voice-test — token-gated. Calls the signer's own mobile
// and reads a short sample in the chosen Twilio voice so they can hear it live.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token ?? '');
  const voice = body.voice;

  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  if (!isValidVoice(voice)) return NextResponse.json({ error: 'Unknown voice' }, { status: 400 });

  const signup = await prisma.trialSignup.findUnique({ where: { token } });
  if (!signup) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const res = await placeSampleCall(signup.mobile, voice);
  if (!res.success) {
    return NextResponse.json({ error: res.error || 'Could not place the test call.' }, { status: 502 });
  }
  return NextResponse.json({ success: true, mock: Boolean(res.mock) });
}
