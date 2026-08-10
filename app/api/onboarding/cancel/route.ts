import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { sendTrialCancelledAlert } from '@/app/lib/notifications';

export const dynamic = 'force-dynamic';

// POST /api/onboarding/cancel { token } — public, token-gated. Marks the trial
// cancelled and notifies the operator. Nothing bills anyone, so this is safe.
export async function POST(request: NextRequest) {
  let token = '';
  try {
    const body = await request.json();
    token = String(body.token ?? '');
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const signup = await prisma.trialSignup.findUnique({ where: { token } });
  if (!signup) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (signup.status === 'cancelled' || signup.status === 'cancel_requested') {
    return NextResponse.json({ success: true, alreadyCancelled: true });
  }

  // Client requests cancellation: stop their live service right away and flag it
  // for the operator to finalize (release number, etc.) from the dashboard.
  await prisma.trialSignup.update({
    where: { token },
    data: {
      status: 'cancel_requested',
      notes: `${signup.notes ? signup.notes + '\n' : ''}Cancellation requested by client on ${new Date().toISOString()}`,
    },
  });
  await prisma.businessConfig.updateMany({ where: { signupId: signup.id }, data: { active: false } });

  // Await (best-effort): on serverless an un-awaited promise is dropped once the
  // response is sent, which would silently swallow this operator alert.
  await Promise.allSettled([
    sendTrialCancelledAlert({
      businessName: signup.businessName,
      email: signup.email,
      mobile: signup.mobile,
    }),
  ]);

  return NextResponse.json({ success: true });
}
