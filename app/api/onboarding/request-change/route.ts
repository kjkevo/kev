import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { sendChangeRequestedAlert } from '@/app/lib/notifications';

export const dynamic = 'force-dynamic';

// POST /api/onboarding/request-change — the client asks for a tweak from the
// review page before going live. We alert the operator with their note; nothing
// is started until they confirm.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token ?? '');
  const note = typeof body.note === 'string' ? body.note.slice(0, 2000) : '';
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const signup = await prisma.trialSignup.findUnique({ where: { token } });
  if (!signup) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await Promise.allSettled([
    sendChangeRequestedAlert({ businessName: signup.businessName, email: signup.email, note }),
  ]);

  return NextResponse.json({ success: true });
}
