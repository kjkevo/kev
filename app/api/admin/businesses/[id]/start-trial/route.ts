import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';
import { sendProvisionedWelcome } from '@/app/lib/notifications';

export const dynamic = 'force-dynamic';

// POST /api/admin/businesses/[id]/start-trial — turn a built (but off) business
// ON and start its 14-day free-trial clock. This is the "go live" moment after
// the client green-lights their setup. Emails them their number + forwarding.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const business = await prisma.businessConfig.findUnique({ where: { id } });
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await prisma.businessConfig.update({
    where: { id },
    data: { active: true, trialEndsAt, trialReminderStage: 0 },
  });

  if (business.signupId != null) {
    await prisma.trialSignup.update({ where: { id: business.signupId }, data: { status: 'onboarded' } });
  }

  // They're live now — email their number + the forwarding step.
  sendProvisionedWelcome(business.ownerEmail, business.businessName, business.businessPhone).catch(console.error);

  return NextResponse.json({ success: true, trialEndsAt: trialEndsAt.toISOString() });
}
