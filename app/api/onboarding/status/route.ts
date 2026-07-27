import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { stripeConfigured } from '@/app/lib/stripe';

export const dynamic = 'force-dynamic';

// GET /api/onboarding/status?t=<token> — public, token-gated trial status for
// the /welcome page. Returns only what the signer needs to see.
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('t') || '';
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const signup = await prisma.trialSignup.findUnique({ where: { token } });
  if (!signup) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // If they've been provisioned, surface their number + so the page can show
  // the go-live step.
  let phoneNumber: string | null = null;
  if (signup.status === 'onboarded') {
    const business = await prisma.businessConfig.findFirst({
      where: { ownerEmail: signup.email },
      orderBy: { id: 'desc' },
    });
    phoneNumber = business?.businessPhone ?? null;
  }

  return NextResponse.json({
    businessName: signup.businessName,
    status: signup.status,
    phoneNumber,
    subscriptionStatus: signup.subscriptionStatus,
    hasBilling: Boolean(signup.stripeCustomerId),
    billingEnabled: stripeConfigured,
    servicePreference: signup.servicePreference,
    exampleMessages: signup.exampleMessages,
    onboardingDetails: signup.onboardingDetails,
    intakeSubmitted: Boolean(signup.intakeSubmittedAt),
  });
}
