import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { sendIntakeSubmittedAlert } from '@/app/lib/notifications';

export const dynamic = 'force-dynamic';

const VALID_SERVICES = ['voice', 'text', 'both'];

// POST /api/onboarding/intake { token, service, examples }
// Public, token-gated. Step 1 of the setup form: the client tells us what
// service they want and example messages. Saves it and emails the operator.
export async function POST(request: NextRequest) {
  let token = '';
  let service = '';
  let examples = '';
  try {
    const body = await request.json();
    token = String(body.token ?? '');
    service = String(body.service ?? '').toLowerCase();
    examples = String(body.examples ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  if (!VALID_SERVICES.includes(service)) {
    return NextResponse.json({ error: 'Please choose Voice, Text, or Both.' }, { status: 400 });
  }
  if (examples.length > 2000) examples = examples.slice(0, 2000);

  const signup = await prisma.trialSignup.findUnique({ where: { token } });
  if (!signup) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.trialSignup.update({
    where: { token },
    data: {
      servicePreference: service,
      exampleMessages: examples || null,
      intakeSubmittedAt: new Date(),
    },
  });

  // Best-effort — the client's submission shouldn't fail because email is down.
  sendIntakeSubmittedAlert({
    businessName: signup.businessName,
    email: signup.email,
    mobile: signup.mobile,
    servicePreference: service,
    exampleMessages: examples,
  }).catch(console.error);

  return NextResponse.json({ success: true });
}
