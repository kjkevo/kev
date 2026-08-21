import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';
import { provisionNumber, attachToMessagingService } from '@/app/lib/twilio';
import { scanWebsite } from '@/app/lib/website';

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
  // Guard on an existing business (not status), since provisioning no longer
  // starts the trial and we don't want to buy a second number.
  const existing = await prisma.businessConfig.findUnique({ where: { signupId: id } });
  if (existing) {
    return NextResponse.json({ error: 'This client already has a service built.' }, { status: 409 });
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

  // Auto-register the new number under our approved A2P campaign by attaching it
  // to the Messaging Service — no new brand/campaign per number. Best-effort.
  if (result.sid) await attachToMessagingService(result.sid).catch(() => {});

  // A personalized text-back so the business is ready to go the moment it's live.
  const tradeClause = signup.trade && signup.trade.trim() ? ` about ${signup.trade.trim()}` : '';
  const missedCallMessage =
    `Sorry we missed your call! Thanks for reaching out to {BUSINESS_NAME}${tradeClause}. ` +
    `What can we help you with? We'll be right back with you.`;

  // Pre-fill channel toggles and the chosen voice from what the client picked
  // on their setup form, so the built service already matches their answers.
  const service = signup.servicePreference;
  const details = (signup.onboardingDetails as Record<string, string> | null) || {};
  const wantsText = service === 'text' || service === 'both' || !service;
  const wantsVoice = service === 'voice' || service === 'both';
  const chosenVoice = typeof details.voiceName === 'string' ? details.voiceName : null;

  let business;
  try {
    business = await prisma.businessConfig.create({
      data: {
        businessName: signup.businessName,
        businessPhone: result.phoneNumber,
        ownerPhone: signup.mobile,
        ownerEmail: signup.email,
        missedCallMessage,
        smsEnabled: wantsText,
        voiceEnabled: wantsVoice,
        voice: chosenVoice,
        // Built but OFF: no live texts and no trial clock until the client
        // confirms their setup, which starts the 7-day trial.
        active: false,
        signupId: signup.id,
        trialEndsAt: null,
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

  // If they gave a website, scan it now so both assistants are grounded in it.
  // Best-effort: on success store the facts sheet; on failure store a note so
  // the operator can see it (Preflight surfaces it) and fill facts by hand.
  const detailsOut: Record<string, string> = { ...details };
  const website = (details.websiteUrl || '').trim();
  if (website) {
    try {
      const scan = await scanWebsite(website, signup.businessName);
      if (scan.summary) {
        detailsOut.websiteSummary = scan.summary;
        delete detailsOut.websiteScanNote;
      } else {
        detailsOut.websiteScanNote = `Could not scan ${website} on ${new Date().toISOString()}: ${scan.error || 'no usable content'}`;
      }
    } catch (e) {
      detailsOut.websiteScanNote = `Website scan errored for ${website}: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  await prisma.trialSignup.update({
    where: { id },
    data: {
      // Not 'onboarded' yet — that means live. Provisioning just builds it.
      status: 'contacted',
      onboardingDetails: detailsOut,
      notes: `${signup.notes ? signup.notes + '\n' : ''}Built (number ${result.phoneNumber}) on ${new Date().toISOString()}${result.mock ? ' (MOCK — Twilio not configured)' : ''}`,
    },
  });

  // No client email here — the client is emailed when you send the confirmation
  // and again when you start their trial (they go live).

  return NextResponse.json({
    success: true,
    businessId: business.id,
    phoneNumber: result.phoneNumber,
    mock: Boolean(result.mock),
  });
}
