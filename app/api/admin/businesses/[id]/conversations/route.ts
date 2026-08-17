import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';

export const dynamic = 'force-dynamic';

// GET /api/admin/businesses/[id]/conversations — recent voice call summaries and
// text threads for a business, grouped by the customer's phone number, so the
// operator can read what the assistants have been handling.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const business = await prisma.businessConfig.findUnique({ where: { id } });
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

  const rows = await prisma.conversationMessage.findMany({
    where: { businessId: id },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  // Group by contact, newest contact first; messages within a contact oldest→newest.
  const byContact = new Map<string, { contactPhone: string; lastAt: string; messages: { at: string; channel: string; role: string; body: string }[] }>();
  for (const r of rows) {
    const key = r.contactPhone;
    if (!byContact.has(key)) byContact.set(key, { contactPhone: key, lastAt: r.createdAt.toISOString(), messages: [] });
    byContact.get(key)!.messages.push({ at: r.createdAt.toISOString(), channel: r.channel, role: r.role, body: r.body });
  }
  const threads = Array.from(byContact.values()).map((t) => ({
    ...t,
    messages: t.messages.slice().reverse(),
  }));

  return NextResponse.json({ businessName: business.businessName, threads });
}
