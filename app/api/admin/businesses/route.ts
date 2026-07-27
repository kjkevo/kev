import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';
import { normalizePhone } from '@/app/lib/phone';
import { normalizeVoiceMenuForStore } from '@/app/lib/voiceMenu';

// GET /api/admin/businesses — list all businesses
export async function GET(request: NextRequest) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const businesses = await prisma.businessConfig.findMany({
    orderBy: { id: 'asc' },
  });
  // Attach each business's billing status (lives on the linked TrialSignup) so
  // the admin can see who's on a trial vs. paying at a glance.
  const signupIds = businesses.map((b) => b.signupId).filter((x): x is number => x != null);
  const signups = signupIds.length
    ? await prisma.trialSignup.findMany({
        where: { id: { in: signupIds } },
        select: { id: true, subscriptionStatus: true },
      })
    : [];
  const subById = new Map(signups.map((s) => [s.id, s.subscriptionStatus]));
  const withBilling = businesses.map((b) => ({
    ...b,
    subscriptionStatus: b.signupId != null ? subById.get(b.signupId) ?? null : null,
  }));
  return NextResponse.json({ businesses: withBilling });
}

// POST /api/admin/businesses — create a business
export async function POST(request: NextRequest) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const businessName = String(body.businessName ?? '').trim();
  const ownerEmail = String(body.ownerEmail ?? '').trim();
  const businessPhone = normalizePhone(String(body.businessPhone ?? ''));
  const ownerPhone = normalizePhone(String(body.ownerPhone ?? ''));

  const errors: string[] = [];
  if (!businessName) errors.push('businessName is required');
  if (!businessPhone) errors.push('businessPhone must be a valid US phone number');
  if (!ownerPhone) errors.push('ownerPhone must be a valid US phone number');
  if (!ownerEmail) errors.push('ownerEmail is required');
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
  }

  try {
    const business = await prisma.businessConfig.create({
      data: {
        businessName,
        businessPhone: businessPhone!,
        ownerPhone: ownerPhone!,
        ownerEmail,
        smsEnabled: body.smsEnabled === undefined ? true : Boolean(body.smsEnabled),
        voiceEnabled: Boolean(body.voiceEnabled),
        recordVoicemail: Boolean(body.recordVoicemail),
        ...(body.missedCallMessage ? { missedCallMessage: String(body.missedCallMessage) } : {}),
        ...(body.leadSubmissionMsg ? { leadSubmissionMsg: String(body.leadSubmissionMsg) } : {}),
        ...(body.voiceGreeting ? { voiceGreeting: String(body.voiceGreeting) } : {}),
        ...(body.voiceMenu !== undefined
          ? { voiceMenu: (normalizeVoiceMenuForStore(body.voiceMenu) ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
    return NextResponse.json({ business }, { status: 201 });
  } catch (error: unknown) {
    // Unique constraint on businessPhone
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'A business with that phone number already exists' },
        { status: 409 }
      );
    }
    console.error('Error creating business:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
