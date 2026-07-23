import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';

// PATCH /api/admin/support/:id — update a ticket's status (open | resolved)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const status = String(body.status ?? '');
  if (status !== 'open' && status !== 'resolved') {
    return NextResponse.json({ error: 'status must be "open" or "resolved"' }, { status: 400 });
  }

  try {
    const ticket = await prisma.supportTicket.update({ where: { id }, data: { status } });
    return NextResponse.json({ ticket });
  } catch (error: unknown) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : undefined;
    if (code === 'P2025') {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }
    console.error('Error updating support ticket:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
