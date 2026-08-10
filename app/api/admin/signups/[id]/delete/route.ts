import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';
import { cancelSubscription, stripeConfigured } from '@/app/lib/stripe';

export const dynamic = 'force-dynamic';

// POST /api/admin/signups/[id]/delete — hard-delete a signup and everything tied
// to it. Unlike "Remove" (soft: keeps history, turns service off), this PURGES
// the record — meant for test/junk entries. Cancels any Stripe subscription,
// deletes the linked business (which cascades its missed calls + lead
// submissions), then deletes the signup itself.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid signup id' }, { status: 400 });

  const signup = await prisma.trialSignup.findUnique({ where: { id } });
  if (!signup) return NextResponse.json({ error: 'Signup not found' }, { status: 404 });

  // Stop any live billing first (best-effort — a stale sub shouldn't block delete).
  if (signup.stripeSubscriptionId && stripeConfigured) {
    await cancelSubscription(signup.stripeSubscriptionId).catch(() => {});
  }

  // Delete the linked business if one was provisioned. MissedCall and
  // LeadSubmission cascade off BusinessConfig, so they go with it.
  await prisma.businessConfig.deleteMany({ where: { signupId: id } });

  // Finally remove the signup itself.
  await prisma.trialSignup.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
