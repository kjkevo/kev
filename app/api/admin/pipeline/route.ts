import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';

export const dynamic = 'force-dynamic';

const PAID = ['active', 'trialing'];

// GET /api/admin/pipeline — one unified, categorized view of every client:
//   category 'paying' | 'trial' | 'review' | 'new'
//   stage    paying | trial | trial_ended | built | form_in | no_form
// plus the bill date (trial end for trials, next charge for payers) and the
// full onboarding-form answers so you can review submissions in one place.
export async function GET(request: NextRequest) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const [signups, businesses] = await Promise.all([
    prisma.trialSignup.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.businessConfig.findMany(),
  ]);
  const bizBySignup = new Map(businesses.filter((b) => b.signupId != null).map((b) => [b.signupId as number, b]));

  const now = Date.now();
  type Client = {
    signupId: number | null;
    businessId: number | null;
    businessName: string;
    email: string;
    mobile: string;
    trade: string | null;
    servicePreference: string | null;
    onboardingDetails: Record<string, string> | null;
    intakeSubmitted: boolean;
    active: boolean | null;
    subscriptionStatus: string | null;
    category: 'paying' | 'trial' | 'review' | 'new' | 'cancel_requested';
    stage: string;
    billDate: string | null;
    // When they came in: form-submission time if submitted, else signup time.
    submittedAt: string | null;
    // Built-service config (null until provisioned) for the setup editor.
    missedCallMessage: string | null;
    leadSubmissionMsg: string | null;
    smsEnabled: boolean | null;
    voiceEnabled: boolean | null;
    voiceGreeting: string | null;
    voice: string | null;
    aiTextEnabled: boolean | null;
    postCallText: boolean | null;
  };

  const clients: Client[] = [];

  for (const s of signups) {
    if (s.status === 'cancelled' || s.status === 'declined') continue;
    const b = bizBySignup.get(s.id);
    const sub = s.subscriptionStatus ?? null;
    let category: Client['category'];
    let stage: string;
    let billDate: string | null = null;

    if (s.status === 'cancel_requested') {
      category = 'cancel_requested'; stage = 'cancel_requested';
    } else if (sub && PAID.includes(sub)) {
      category = 'paying'; stage = 'paying';
      billDate = s.currentPeriodEnd ? s.currentPeriodEnd.toISOString() : null;
    } else if (b && b.active && b.trialEndsAt && b.trialEndsAt.getTime() > now) {
      category = 'trial'; stage = 'trial';
      billDate = b.trialEndsAt.toISOString();
    } else if (b && b.trialEndsAt && b.trialEndsAt.getTime() <= now) {
      category = 'review'; stage = 'trial_ended';
      billDate = b.trialEndsAt.toISOString();
    } else if (b) {
      category = 'review'; stage = 'built';
    } else if (s.intakeSubmittedAt) {
      category = 'review'; stage = 'form_in';
    } else {
      category = 'new'; stage = 'no_form';
    }

    clients.push({
      signupId: s.id,
      businessId: b?.id ?? null,
      businessName: s.businessName,
      email: s.email,
      mobile: s.mobile,
      trade: s.trade ?? null,
      servicePreference: s.servicePreference ?? null,
      onboardingDetails: (s.onboardingDetails as Record<string, string> | null) ?? null,
      intakeSubmitted: Boolean(s.intakeSubmittedAt),
      active: b ? b.active : null,
      subscriptionStatus: sub,
      category,
      stage,
      billDate,
      submittedAt: (s.intakeSubmittedAt ?? s.createdAt).toISOString(),
      missedCallMessage: b?.missedCallMessage ?? null,
      leadSubmissionMsg: b?.leadSubmissionMsg ?? null,
      smsEnabled: b?.smsEnabled ?? null,
      voiceEnabled: b?.voiceEnabled ?? null,
      voiceGreeting: b?.voiceGreeting ?? null,
      voice: b?.voice ?? null,
      aiTextEnabled: b?.aiTextEnabled ?? null,
      postCallText: b?.postCallText ?? null,
    });
  }

  return NextResponse.json({ clients });
}
