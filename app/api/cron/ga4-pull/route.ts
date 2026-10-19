import { NextRequest, NextResponse } from 'next/server';
import { runGa4PullForAllClients } from '@/app/lib/ga4Pull';

export const dynamic = 'force-dynamic';

// Weekly (or monthly, per-client) GA4 pull. Vercel Cron sends
// `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set — enforce it
// in production so this can't be triggered by anyone else. The demo client
// (propertyId null) is skipped; it's refreshed by scripts/seed-ga4-demo.ts.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization') || '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  const results = await runGa4PullForAllClients(baseUrl);
  const failures = results.filter((r) => !r.ok);

  return NextResponse.json({
    ok: failures.length === 0,
    pulled: results.length,
    failures: failures.length,
    results,
    checkedAt: new Date().toISOString(),
  });
}
