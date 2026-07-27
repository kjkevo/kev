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
  let details: Record<string, string> = {};
  try {
    const body = await request.json();
    token = String(body.token ?? '');
    service = String(body.service ?? '').toLowerCase();
    // Full questionnaire answers: keep only string values, cap length per field.
    if (body.details && typeof body.details === 'object') {
      for (const [k, v] of Object.entries(body.details as Record<string, unknown>)) {
        if (v == null) continue;
        const val = String(v).trim();
        if (val) details[k] = val.slice(0, 4000);
      }
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  if (!VALID_SERVICES.includes(service)) {
    return NextResponse.json({ error: 'Please choose Voice, Text, or Both.' }, { status: 400 });
  }

  const signup = await prisma.trialSignup.findUnique({ where: { token } });
  if (!signup) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.trialSignup.update({
    where: { token },
    data: {
      servicePreference: service,
      // Promote the sample-messages answer to its own column for convenience.
      exampleMessages: details.exampleMessages || null,
      onboardingDetails: details,
      intakeSubmittedAt: new Date(),
    },
  });

  // Best-effort — the client's submission shouldn't fail because email is down.
  sendIntakeSubmittedAlert({
    businessName: signup.businessName,
    email: signup.email,
    mobile: signup.mobile,
    servicePreference: service,
    details,
  }).catch(console.error);

  return NextResponse.json({ success: true });
}
