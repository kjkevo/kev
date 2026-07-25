import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { createCheckoutSession, stripeConfigured } from '@/app/lib/stripe';

export const dynamic = 'force-dynamic';

// POST /api/billing/checkout { token, plan? } — public, token-gated. Starts the
// "add payment to continue" flow for a trial signup.
export async function POST(request: NextRequest) {
  if (!stripeConfigured) {
    return NextResponse.json({ error: 'Billing is not set up yet. Please check back soon.' }, { status: 503 });
  }

  let token = '';
  let plan = 'monthly';
  try {
    const body = await request.json();
    token = String(body.token ?? '');
    if (body.plan === 'annual') plan = 'annual';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const signup = await prisma.trialSignup.findUnique({ where: { token } });
  if (!signup) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const origin = new URL(request.url).origin;
  const { url, error } = await createCheckoutSession({
    token,
    email: signup.email,
    businessName: signup.businessName,
    plan,
    customerId: signup.stripeCustomerId,
    successUrl: `${origin}/welcome?t=${token}&paid=1`,
    cancelUrl: `${origin}/welcome?t=${token}`,
  });

  if (!url) return NextResponse.json({ error: error || 'Could not start checkout.' }, { status: 502 });
  return NextResponse.json({ url });
}
