import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';
import { sendSetupConfirmationEmail } from '@/app/lib/notifications';

export const dynamic = 'force-dynamic';

// POST /api/admin/businesses/[id]/send-confirmation — email the client the setup
// you built so they can confirm it looks good before you start their trial.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const business = await prisma.businessConfig.findUnique({ where: { id } });
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

  // Link back to their setup page if we can find the token.
  let reviewUrl = '';
  if (business.signupId != null) {
    const signup = await prisma.trialSignup.findUnique({ where: { id: business.signupId }, select: { token: true } });
    if (signup?.token) reviewUrl = `${new URL(request.url).origin}/welcome?t=${signup.token}`;
  }

  const channel = business.voiceEnabled && business.smsEnabled ? 'Voice + Text'
    : business.voiceEnabled ? 'Voice' : 'Text';

  const result = await sendSetupConfirmationEmail({
    toEmail: business.ownerEmail,
    businessName: business.businessName,
    channel,
    phoneNumber: business.businessPhone,
    smsEnabled: business.smsEnabled,
    voiceEnabled: business.voiceEnabled,
    // Only include each channel's preview when that channel is actually on, so
    // the email matches exactly what the client picked (Text / Voice / Both).
    missedCallMessage: business.smsEnabled ? business.missedCallMessage : undefined,
    voiceGreeting: business.voiceEnabled ? business.voiceGreeting : undefined,
    reviewUrl,
  });
  if (!result.success) return NextResponse.json({ error: result.error || 'Could not send' }, { status: 502 });
  return NextResponse.json({ success: true });
}
