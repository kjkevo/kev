import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';
import { provisionNumber } from '@/app/lib/twilio';
import { sendProvisionedWelcome } from '@/app/lib/notifications';

// POST /api/admin/signups/[id]/provision — the one-click flow: buy a number,
// wire its webhooks to this app, create the business, mark the signup onboarded,
// and email the client their number + forwarding step.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Invalid signup id' }, { status: 400 });
  }

  const signup = await prisma.trialSignup.findUnique({ where: { id } });
  if (!signup) {
    return NextResponse.json({ error: 'Signup not found' }, { status: 404 });
  }
  if (signup.status === 'onboarded') {
    return NextResponse.json({ error: 'This signup has already been provisioned.' }, { status: 409 });
  }

  // Build webhook URLs from this request's own origin so provisioning works on
  // whatever domain the app is deployed to, with no extra config.
  const origin = new URL(request.url).origin;
  const voiceUrl = `${origin}/api/webhooks/twilio/incoming-call`;
  const statusCallbackUrl = `${origin}/api/webhooks/twilio/call-status`;
  const smsUrl = `${origin}/api/webhooks/twilio/sms-inbound`;

  // Prefer a number in the prospect's own area code (digits 2–4 of +1AAANNNNNNN).
  const areaCode = /^\+1\d{10}$/.test(signup.mobile) ? signup.mobile.slice(2, 5) : undefined;

  const result = await provisionNumber({
    areaCode,
    voiceUrl,
    statusCallbackUrl,
    smsUrl,
    friendlyName: signup.businessName,
  });
  if (!result.success || !result.phoneNumber) {
    return NextResponse.json({ error: result.error || 'Could not provision a number.' }, { status: 502 });
  }

  // A personalized text-back so the business is ready to go the moment it's live.
  const tradeClause = signup.trade && signup.trade.trim() ? ` about ${signup.trade.trim()}` : '';
  const missedCallMessage =
    `Sorry we missed your call! Thanks for reaching out to {BUSINESS_NAME}${tradeClause}. ` +
    `What can we help you with? We'll be right back with you.`;

  let business;
  try {
    business = await prisma.businessConfig.create({
      data: {
        businessName: signup.businessName,
        businessPhone: result.phoneNumber,
        ownerPhone: signup.mobile,
        ownerEmail: signup.email,
        missedCallMessage,
        smsEnabled: true,
        voiceEnabled: false,
      },
    });
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: `A business already uses ${result.phoneNumber}. The number was purchased — add it manually.` },
        { status: 409 },
      );
    }
    console.error('Error creating business during provision:', error);
    return NextResponse.json({ error: 'Number bought, but creating the business failed. Add it manually.' }, { status: 500 });
  }

  await prisma.trialSignup.update({
    where: { id },
    data: {
      status: 'onboarded',
      notes: `${signup.notes ? signup.notes + '\n' : ''}Provisioned ${result.phoneNumber} on ${new Date().toISOString()}${result.mock ? ' (MOCK — Twilio not configured)' : ''}`,
    },
  });

  // Best-effort: email the client their number + forwarding step.
  sendProvisionedWelcome(signup.email, signup.businessName, result.phoneNumber).catch(console.error);

  return NextResponse.json({
    success: true,
    businessId: business.id,
    phoneNumber: result.phoneNumber,
    mock: Boolean(result.mock),
  });
}
