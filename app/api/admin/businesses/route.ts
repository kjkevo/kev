import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';
import { normalizePhone } from '@/app/lib/phone';

// GET /api/admin/businesses — list all businesses
export async function GET(request: NextRequest) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const businesses = await prisma.businessConfig.findMany({
    orderBy: { id: 'asc' },
  });
  return NextResponse.json({ businesses });
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
