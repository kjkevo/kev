import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { maskPhone } from '@/app/lib/mask';

// Always fetch fresh data — this feed is meant to be live.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/public/activity — public, read-only snapshot for the live dashboard.
// Customer phone numbers are masked; no owner contact details are exposed.
export async function GET() {
  try {
    const [businesses, missedCalls, leads] = await Promise.all([
      prisma.businessConfig.findMany({ orderBy: { id: 'asc' } }),
      prisma.missedCall.findMany({ orderBy: { createdAt: 'desc' }, take: 40 }),
      prisma.leadSubmission.findMany({ orderBy: { createdAt: 'desc' }, take: 40 }),
    ]);

    const nameById = new Map(businesses.map((b) => [b.id, b.businessName]));

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

    type Event = {
      id: string;
      kind: 'missed_call' | 'lead';
      business: string;
      caller: string;
      status: string;
      outbound: string;
      reply: string | null;
      at: string;
    };

    const events: Event[] = [];

    for (const m of missedCalls) {
      events.push({
        id: `mc-${m.id}`,
        kind: 'missed_call',
        business: nameById.get(m.businessId) ?? 'Unknown',
        caller: maskPhone(m.callerPhone),
        status: m.textStatus,
        outbound: businesses.find((b) => b.id === m.businessId)?.missedCallMessage ?? '',
        reply: m.textResponse ?? null,
        at: m.createdAt.toISOString(),
      });
    }

    for (const l of leads) {
      events.push({
        id: `ld-${l.id}`,
        kind: 'lead',
        business: nameById.get(l.businessId) ?? 'Unknown',
        caller: maskPhone(l.phone),
        status: l.textStatus,
        outbound: `Lead: ${l.serviceRequested}`,
        reply: l.textResponse ?? null,
        at: l.createdAt.toISOString(),
      });
    }

    events.sort((a, b) => (a.at < b.at ? 1 : -1));

    return NextResponse.json({
      businesses: businessCards,
      events: events.slice(0, 50),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error building public activity:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
