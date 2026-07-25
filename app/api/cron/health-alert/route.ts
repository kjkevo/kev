import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { sendBillingAlert } from '@/app/lib/notifications';

export const dynamic = 'force-dynamic';

// Daily heartbeat that emails you ONLY when something's wrong — a silent-failure
// backstop so you learn about problems before your clients do. Real-time
// per-text failures are already alerted from the call-status handler; this
// catches database outages and any accumulation of failures.
export async function GET(request: NextRequest) {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is
  // set. Enforce it in production so the endpoint can't be triggered by anyone.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization') || '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const problems: string[] = [];

  // Database — critical.
  let dbOk = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    dbOk = false;
    problems.push(`Database is unreachable: ${String(error)}`);
  }

  // Text failures in the last 24h across both send paths.
  if (dbOk) {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [missedFailures, leadFailures] = await Promise.all([
        prisma.missedCall.count({ where: { textStatus: 'failed', missedAt: { gte: since } } }),
        prisma.leadSubmission.count({ where: { textStatus: 'failed', createdAt: { gte: since } } }),
      ]);
      const total = missedFailures + leadFailures;
      if (total > 0) {
        problems.push(`${total} text-back failure(s) in the last 24h (${missedFailures} missed-call, ${leadFailures} lead).`);
      }
    } catch (error) {
      problems.push(`Couldn't check text failures: ${String(error)}`);
    }
  }

  if (problems.length > 0) {
    await sendBillingAlert(
      `🚨 MissedCall health alert — ${problems.length} issue(s)`,
      `<h2>Something needs your attention</h2><ul>${problems.map((p) => `<li>${p}</li>`).join('')}</ul>
       <p>Checked ${new Date().toLocaleString()}.</p>`,
    );
  }

  return NextResponse.json({ ok: problems.length === 0, problems, checkedAt: new Date().toISOString() });
}
