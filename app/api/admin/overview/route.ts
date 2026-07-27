import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';

export const dynamic = 'force-dynamic';

// GET /api/admin/overview — health-at-a-glance for every ACTIVE business:
// call activity + a green/yellow/red light.
//   green  = live and healthy
//   yellow = struggling (mock mode — real texts aren't going out)
//   red    = technical problem (a text-back failed recently)
export async function GET(request: NextRequest) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const businesses = await prisma.businessConfig.findMany({
    where: { active: true },
    select: { id: true, businessName: true, businessPhone: true },
    orderBy: { businessName: 'asc' },
  });

  const now = Date.now();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now - 48 * 60 * 60 * 1000);

  const [totals, recent, failed] = await Promise.all([
    prisma.missedCall.groupBy({ by: ['businessId'], _count: { _all: true } }),
    prisma.missedCall.groupBy({ by: ['businessId'], where: { missedAt: { gte: weekAgo } }, _count: { _all: true } }),
    prisma.missedCall.groupBy({ by: ['businessId'], where: { textStatus: 'failed', missedAt: { gte: twoDaysAgo } }, _count: { _all: true } }),
  ]);
  const map = (rows: { businessId: number; _count: { _all: number } }[]) =>
    new Map(rows.map((r) => [r.businessId, r._count._all]));
  const totalBy = map(totals);
  const recentBy = map(recent);
  const failedBy = map(failed);

  // Twilio live? (global — affects whether real texts are sent at all)
  const sid = process.env.TWILIO_ACCOUNT_SID || '';
  const token = process.env.TWILIO_AUTH_TOKEN || '';
  const twilioLive = Boolean(sid && token && !sid.includes('PLACEHOLDER') && !token.includes('placeholder'));

  const rows = businesses.map((b) => {
    const failures = failedBy.get(b.id) ?? 0;
    let health: 'green' | 'yellow' | 'red' = 'green';
    let reason = 'All good';
    if (failures > 0) {
      health = 'red';
      reason = `${failures} text-back${failures > 1 ? 's' : ''} failed in the last 48h`;
    } else if (!twilioLive) {
      health = 'yellow';
      reason = 'Mock mode — real texts are not being sent yet';
    }
    return {
      id: b.id,
      businessName: b.businessName,
      businessPhone: b.businessPhone,
      callsTotal: totalBy.get(b.id) ?? 0,
      callsWeek: recentBy.get(b.id) ?? 0,
      health,
      reason,
    };
  });

  return NextResponse.json({ businesses: rows });
}
