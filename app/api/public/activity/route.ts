import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { maskPhone } from '@/app/lib/mask';

// Always fetch fresh data — this feed is meant to be live.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const REVENUE_STATUSES = ['booked', 'won'];

// GET /api/public/activity — public, read-only snapshot for the live dashboard.
// Customer phone numbers are masked; no owner contact details are exposed.
export async function GET() {
  try {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [
      businesses,
      missedCalls,
      leads,
      totalMissed,
      missedThisMonth,
      repliedCount,
      pipelineGroups,
      revenueTotalAgg,
      revenueMonthAgg,
    ] = await Promise.all([
      prisma.businessConfig.findMany({ orderBy: { id: 'asc' } }),
      prisma.missedCall.findMany({ orderBy: { createdAt: 'desc' }, take: 40 }),
      prisma.leadSubmission.findMany({ orderBy: { createdAt: 'desc' }, take: 40 }),
      prisma.missedCall.count(),
      prisma.missedCall.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.missedCall.count({ where: { textStatus: 'sent' } }),
      prisma.missedCall.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.missedCall.aggregate({ _sum: { dealValue: true }, where: { status: { in: REVENUE_STATUSES } } }),
      prisma.missedCall.aggregate({ _sum: { dealValue: true }, where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: monthStart } } }),
    ]);

    const nameById = new Map(businesses.map((b) => [b.id, b.businessName]));
    const msgById = new Map(businesses.map((b) => [b.id, b.missedCallMessage]));

    // Pipeline counts by status
    const pipeline: Record<string, number> = {
      new: 0, contacted: 0, booked: 0, won: 0, lost: 0, no_response: 0, spam: 0,
    };
    for (const g of pipelineGroups) {
      pipeline[g.status] = (pipeline[g.status] ?? 0) + g._count._all;
    }
    const bookedWon = pipeline.booked + pipeline.won;

    const metrics = {
      totalMissed,
      missedThisMonth,
      recoveryRate: totalMissed > 0 ? Math.round((repliedCount / totalMissed) * 100) : 0,
      bookedWon,
      won: pipeline.won,
      recoveredRevenueTotal: revenueTotalAgg._sum.dealValue ?? 0,
      recoveredRevenueMonth: revenueMonthAgg._sum.dealValue ?? 0,
      pipeline,
    };

    type Event = {
      id: string;
      dbId: number | null;
      kind: 'missed_call' | 'lead';
      business: string;
      caller: string;
      delivery: string;
      pipeline: string | null;
      dealValue: number | null;
      notes: string | null;
      outbound: string;
      reply: string | null;
      at: string;
    };

    const events: Event[] = [];

    for (const m of missedCalls) {
      events.push({
        id: `mc-${m.id}`,
        dbId: m.id,
        kind: 'missed_call',
        business: nameById.get(m.businessId) ?? 'Unknown',
        caller: maskPhone(m.callerPhone),
        delivery: m.textStatus,
        pipeline: m.status,
        dealValue: m.dealValue,
        notes: m.notes,
        outbound: msgById.get(m.businessId) ?? '',
        reply: m.textResponse ?? null,
        at: m.createdAt.toISOString(),
      });
    }

    for (const l of leads) {
      events.push({
        id: `ld-${l.id}`,
        dbId: null,
        kind: 'lead',
        business: nameById.get(l.businessId) ?? 'Unknown',
        caller: maskPhone(l.phone),
        delivery: l.textStatus,
        pipeline: null,
        dealValue: null,
        notes: null,
        outbound: `Lead: ${l.serviceRequested}`,
        reply: l.textResponse ?? null,
        at: l.createdAt.toISOString(),
      });
    }

    events.sort((a, b) => (a.at < b.at ? 1 : -1));

    const businessCards = businesses.map((b) => ({
      id: b.id,
      name: b.businessName,
      phone: b.businessPhone,
      smsEnabled: b.smsEnabled,
      voiceEnabled: b.voiceEnabled,
      missedCallMessage: b.missedCallMessage,
      voiceGreeting: b.voiceEnabled ? b.voiceGreeting : null,
      missedCallCount: missedCalls.filter((m) => m.businessId === b.id).length,
    }));

    return NextResponse.json({
      businesses: businessCards,
      events: events.slice(0, 50),
      metrics,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error building public activity:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
