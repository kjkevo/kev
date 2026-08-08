import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';
import { cancelSubscription, stripeConfigured } from '@/app/lib/stripe';

export const dynamic = 'force-dynamic';

// POST /api/admin/businesses/[id]/remove — fully remove a client from service:
// cancel any Stripe subscription, turn the business off, and mark the signup
// cancelled so it drops out of the pipeline. Non-destructive (keeps history).
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

  if (signup?.stripeSubscriptionId && stripeConfigured) {
    await cancelSubscription(signup.stripeSubscriptionId).catch(() => {});
  }

  await prisma.businessConfig.update({ where: { id }, data: { active: false } });
  if (signup) {
    await prisma.trialSignup.update({ where: { id: signup.id }, data: { status: 'cancelled' } });
  }

  return NextResponse.json({ success: true });
}
