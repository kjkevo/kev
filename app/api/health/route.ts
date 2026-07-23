import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

// Health monitor. Point an uptime service (UptimeRobot, Better Uptime, or a
// Vercel Cron) at this endpoint: it returns HTTP 200 when healthy and 503 when
// a critical dependency (the database) is down, so you get alerted on outages.
// It also surfaces two silent-failure modes: Twilio running in mock mode (no
// real texts go out) and recent text-send failures.
export async function GET() {
  const checks: Record<string, unknown> = {};
  let healthy = true;

  // Database — critical. A failure here flips the endpoint to 503.
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok' };
  } catch (error) {
    checks.database = { status: 'error', error: String(error) };
    healthy = false;
  }

  // Twilio — is it configured for real sends, or silently mocking?
  const sid = process.env.TWILIO_ACCOUNT_SID || '';
  const token = process.env.TWILIO_AUTH_TOKEN || '';
  const twilioLive = Boolean(
    sid && token && !sid.includes('PLACEHOLDER') && !token.includes('placeholder'),
  );
  checks.twilio = {
    status: twilioLive ? 'ok' : 'mock',
    note: twilioLive ? 'Live — real texts are sent' : 'Mock mode — NO real texts are sent',
  };

  // Email — used for owner alerts and failure notifications.
  const emailUser = process.env.EMAIL_USER || '';
  const emailPass = process.env.EMAIL_PASSWORD || '';
  const emailReady = Boolean(
    emailUser && emailPass && !emailUser.includes('your-email') && !emailPass.includes('your-app-password'),
  );
  checks.email = { status: emailReady ? 'ok' : 'not_configured' };

  // Operational signal: text failures in the last 24h.
  if (healthy) {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [missedFailures, leadFailures] = await Promise.all([
        prisma.missedCall.count({ where: { textStatus: 'failed', missedAt: { gte: since } } }),
        prisma.leadSubmission.count({ where: { textStatus: 'failed', createdAt: { gte: since } } }),
      ]);
      checks.textFailuresLast24h = missedFailures + leadFailures;
    } catch (error) {
      checks.textFailuresLast24h = { status: 'error', error: String(error) };
    }
  }

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'error',
      checks,
      timestamp: new Date().toISOString(),
      version: '1.1.0',
    },
    { status: healthy ? 200 : 503 },
  );
}
