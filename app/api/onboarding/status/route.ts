import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { stripeConfigured } from '@/app/lib/stripe';

export const dynamic = 'force-dynamic';

// GET /api/onboarding/status?t=<token> — public, token-gated trial status for
// the /welcome page. Returns only what the signer needs to see, including the
// built setup (text-back + voice) so they can review and confirm.
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('t') || '';
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const signup = await prisma.trialSignup.findUnique({ where: { token } });
  if (!signup) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // A provisioned business means their service is built (and maybe live).
  const business = await prisma.businessConfig.findFirst({
    where: { signupId: signup.id },
    orderBy: { id: 'desc' },
  });
  const trialStarted = Boolean(business && business.active && business.trialEndsAt);

  return NextResponse.json({
    businessName: signup.businessName,
    status: signup.status,
    phoneNumber: business?.businessPhone ?? null,
    subscriptionStatus: signup.subscriptionStatus,
    hasBilling: Boolean(signup.stripeCustomerId),
    billingEnabled: stripeConfigured,
    servicePreference: signup.servicePreference,
    exampleMessages: signup.exampleMessages,
    onboardingDetails: signup.onboardingDetails,
    intakeSubmitted: Boolean(signup.intakeSubmittedAt),
    businessBuilt: Boolean(business),
    trialStarted,
    setup: business
      ? {
          missedCallMessage: business.missedCallMessage,
          smsEnabled: business.smsEnabled,
          voiceEnabled: business.voiceEnabled,
          voiceGreeting: business.voiceGreeting,
          voice: business.voice,
        }
      : null,
  });
}
