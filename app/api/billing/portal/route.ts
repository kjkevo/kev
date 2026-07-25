import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { createPortalSession, stripeConfigured } from '@/app/lib/stripe';

export const dynamic = 'force-dynamic';

// POST /api/billing/portal { token } — public, token-gated. Sends a paying
// client to Stripe's billing portal (update card, invoices, cancel).
export async function POST(request: NextRequest) {
  if (!stripeConfigured) {
    return NextResponse.json({ error: 'Billing is not set up yet.' }, { status: 503 });
  }

  let token = '';
  try {
    const body = await request.json();
    token = String(body.token ?? '');
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const signup = await prisma.trialSignup.findUnique({ where: { token } });
  if (!signup?.stripeCustomerId) {
    return NextResponse.json({ error: 'No billing account yet.' }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const { url, error } = await createPortalSession({
    customerId: signup.stripeCustomerId,
    returnUrl: `${origin}/welcome?t=${token}`,
  });
  if (!url) return NextResponse.json({ error: error || 'Could not open billing portal.' }, { status: 502 });
  return NextResponse.json({ url });
}
