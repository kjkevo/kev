import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';
import { cancelSubscription, stripeConfigured } from '@/app/lib/stripe';

export const dynamic = 'force-dynamic';

// POST /api/admin/businesses/[id]/cancel-subscription — end a paying client:
// cancel their Stripe subscription (stops billing) and turn their service off.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const business = await prisma.businessConfig.findUnique({ where: { id } });
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

  const signup = business.signupId != null
    ? await prisma.trialSignup.findUnique({ where: { id: business.signupId } })
    : null;

  // Cancel the live Stripe subscription if there is one.
  if (signup?.stripeSubscriptionId && stripeConfigured) {
    const res = await cancelSubscription(signup.stripeSubscriptionId);
    if (!res.ok) return NextResponse.json({ error: res.error || 'Could not cancel subscription.' }, { status: 502 });
  }

  // Turn off the service and mark it canceled.
  await prisma.businessConfig.update({ where: { id }, data: { active: false } });
  if (signup) {
    await prisma.trialSignup.update({ where: { id: signup.id }, data: { subscriptionStatus: 'canceled' } });
  }

  return NextResponse.json({ success: true });
}
