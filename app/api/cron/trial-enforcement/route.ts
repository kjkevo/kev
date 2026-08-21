import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import {
  sendTrialReminderEmail,
  sendTrialEndedEmail,
  sendBillingAlert,
} from '@/app/lib/notifications';

export const dynamic = 'force-dynamic';

const DAY = 24 * 60 * 60 * 1000;
const PAID_STATUSES = ['active', 'trialing'];

// Daily job that enforces the no-card 7-day free trial:
//  • sends reminders ~4 days and ~1 day before the trial ends,
//  • auto-disables a business at trial end if it has no active subscription,
//  • re-enables a business that has since started paying (reconcile).
// A paying client (subscription active) is never disabled here.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization') || '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const baseUrl = (process.env.APP_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
  const now = Date.now();
  const summary = { reminded: 0, disabled: 0, reenabled: 0 };

  // Only businesses that were provisioned on a trial (have a trialEndsAt).
  const businesses = await prisma.businessConfig.findMany({
    where: { trialEndsAt: { not: null } },
    select: { id: true, businessName: true, ownerEmail: true, active: true, trialEndsAt: true, trialReminderStage: true, signupId: true },
  });

  // Fetch linked signups (billing status + token for the payment link) in one go.
  const signupIds = businesses.map((b) => b.signupId).filter((x): x is number => x != null);
  const signups = signupIds.length
    ? await prisma.trialSignup.findMany({
        where: { id: { in: signupIds } },
        select: { id: true, subscriptionStatus: true, token: true },
      })
    : [];
  const signupById = new Map(signups.map((s) => [s.id, s]));

  for (const b of businesses) {
    const signup = b.signupId != null ? signupById.get(b.signupId) : undefined;
    const isPaid = signup?.subscriptionStatus ? PAID_STATUSES.includes(signup.subscriptionStatus) : false;
    const paymentUrl = signup?.token && baseUrl ? `${baseUrl}/welcome?t=${signup.token}` : baseUrl || '#';

    // Reconcile: a paying client that somehow got disabled → turn back on.
    if (isPaid) {
      if (!b.active) {
        await prisma.businessConfig.update({ where: { id: b.id }, data: { active: true } });
        summary.reenabled++;
      }
      continue;
    }

    if (!b.trialEndsAt) continue;
    const msLeft = b.trialEndsAt.getTime() - now;
    const daysLeft = Math.ceil(msLeft / DAY);

    // Trial ended, still no payment → shut off (once).
    if (msLeft <= 0) {
      if (b.active) {
        await prisma.businessConfig.update({ where: { id: b.id }, data: { active: false } });
        summary.disabled++;
        await sendTrialEndedEmail(b.ownerEmail, b.businessName, paymentUrl).catch(() => {});
        await sendBillingAlert(
          `Trial ended (unpaid): ${b.businessName}`,
          `<p><strong>${b.businessName}</strong> reached the end of its 7-day trial with no card on file, so its service was paused automatically.</p>`,
        ).catch(() => {});
      }
      continue;
    }

    // Reminders: stage 1 at ≤4 days left, stage 2 at ≤1 day left.
    if (daysLeft <= 1 && b.trialReminderStage < 2) {
      await sendTrialReminderEmail(b.ownerEmail, b.businessName, daysLeft, paymentUrl).catch(() => {});
      await prisma.businessConfig.update({ where: { id: b.id }, data: { trialReminderStage: 2 } });
      summary.reminded++;
    } else if (daysLeft <= 4 && b.trialReminderStage < 1) {
      await sendTrialReminderEmail(b.ownerEmail, b.businessName, daysLeft, paymentUrl).catch(() => {});
      await prisma.businessConfig.update({ where: { id: b.id }, data: { trialReminderStage: 1 } });
      summary.reminded++;
    }
  }

  return NextResponse.json({ ok: true, ...summary, checkedAt: new Date().toISOString() });
}
