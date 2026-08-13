import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { sendProvisionedWelcome, sendSetupConfirmedAlert } from '@/app/lib/notifications';

export const dynamic = 'force-dynamic';

// POST /api/onboarding/confirm — the client green-lights their setup from the
// review page. This turns their built service ON and starts the 14-day free
// trial (no operator step needed), then emails them their number and alerts us.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token ?? '');
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const signup = await prisma.trialSignup.findUnique({ where: { token } });
  if (!signup) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const business = await prisma.businessConfig.findUnique({ where: { signupId: signup.id } });
  if (!business) return NextResponse.json({ error: 'Your setup is still being built. Please check back soon.' }, { status: 409 });

  // Already live? Just report success (idempotent).
  if (!business.active || !business.trialEndsAt) {
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    await prisma.businessConfig.update({
      where: { id: business.id },
      data: { active: true, trialEndsAt, trialReminderStage: 0 },
    });
  }
  await prisma.trialSignup.update({ where: { id: signup.id }, data: { status: 'onboarded' } });

  await Promise.allSettled([
    sendProvisionedWelcome(business.ownerEmail, business.businessName, business.businessPhone),
    sendSetupConfirmedAlert({ businessName: business.businessName, phoneNumber: business.businessPhone }),
  ]);

  return NextResponse.json({ success: true, phoneNumber: business.businessPhone });
}
