import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';

export const dynamic = 'force-dynamic';

// Statuses that count as a customer who engaged after the text-back.
const ENGAGED = ['contacted', 'booked', 'won'];
const CONVERTED = ['booked', 'won'];

// GET /api/admin/analytics — the numbers you actually sell on: recovery rate,
// response time, conversion, and recovered revenue. Overall + per business.
export async function GET(request: NextRequest) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const calls = await prisma.missedCall.findMany({
    select: {
      businessId: true, status: true, dealValue: true, missedAt: true, textSentAt: true,
    },
  });
  const businesses = await prisma.businessConfig.findMany({ select: { id: true, businessName: true } });
  const nameById = new Map(businesses.map((b) => [b.id, b.businessName]));

  type Agg = {
    businessId: number; businessName: string; total: number; engaged: number;
    converted: number; revenue: number; responseSum: number; responseCount: number;
  };
  const empty = (id: number): Agg => ({
    businessId: id, businessName: nameById.get(id) ?? `#${id}`, total: 0, engaged: 0,
    converted: 0, revenue: 0, responseSum: 0, responseCount: 0,
  });

  const overall = empty(0);
  overall.businessName = 'All businesses';
  const perBiz = new Map<number, Agg>();

  for (const c of calls) {
    const a = perBiz.get(c.businessId) ?? empty(c.businessId);
    for (const agg of [a, overall]) {
      agg.total += 1;
      if (ENGAGED.includes(c.status)) agg.engaged += 1;
      if (CONVERTED.includes(c.status)) {
        agg.converted += 1;
        agg.revenue += c.dealValue ?? 0;
      }
      if (c.textSentAt && c.missedAt) {
        const secs = (c.textSentAt.getTime() - c.missedAt.getTime()) / 1000;
        if (secs >= 0 && secs < 3600) { agg.responseSum += secs; agg.responseCount += 1; }
      }
    }
    perBiz.set(c.businessId, a);
  }

  const shape = (a: Agg) => ({
    businessId: a.businessId,
    businessName: a.businessName,
    totalMissedCalls: a.total,
    recoveryRate: a.total ? Math.round((a.engaged / a.total) * 100) : 0,
    conversions: a.converted,
    recoveredRevenue: Math.round(a.revenue),
    avgResponseSeconds: a.responseCount ? Math.round(a.responseSum / a.responseCount) : null,
  });

  return NextResponse.json({
    overall: shape(overall),
    perBusiness: Array.from(perBiz.values())
      .map(shape)
      .sort((x, y) => y.recoveredRevenue - x.recoveredRevenue || y.totalMissedCalls - x.totalMissedCalls),
  });
}
