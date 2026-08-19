import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';
import { renderSetupConfirmationEmail } from '@/app/lib/notifications';
import { voiceFirstMessage } from '@/app/lib/ai';

export const dynamic = 'force-dynamic';

// POST /api/admin/businesses/[id]/confirmation-preview — render the setup
// confirmation email (with the operator's optional subject/note edits) so it
// can be reviewed BEFORE sending. Does not send anything.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const business = await prisma.businessConfig.findUnique({ where: { id } });
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const subject = typeof body.subject === 'string' ? body.subject : undefined;
  const customNote = typeof body.customNote === 'string' ? body.customNote : undefined;

  let reviewUrl = '';
  if (business.signupId != null) {
    const signup = await prisma.trialSignup.findUnique({ where: { id: business.signupId }, select: { token: true } });
    if (signup?.token) reviewUrl = `${new URL(request.url).origin}/welcome?t=${signup.token}`;
  }

  const channel = business.voiceEnabled && business.smsEnabled ? 'Voice + Text'
    : business.voiceEnabled ? 'Voice' : 'Text';

  const { subject: renderedSubject, html } = renderSetupConfirmationEmail({
    toEmail: business.ownerEmail,
    businessName: business.businessName,
    channel,
    phoneNumber: business.businessPhone,
    smsEnabled: business.smsEnabled,
    voiceEnabled: business.voiceEnabled,
    missedCallMessage: business.smsEnabled ? business.missedCallMessage : undefined,
    voiceGreeting: business.voiceEnabled ? voiceFirstMessage(business.businessName) : undefined,
    reviewUrl,
    subject,
    customNote,
  });

  return NextResponse.json({ to: business.ownerEmail, subject: renderedSubject, html });
}
