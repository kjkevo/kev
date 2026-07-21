import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';

const VALID_STATUSES = ['new', 'contacted', 'booked', 'won', 'lost', 'no_response', 'spam'];

// PATCH /api/admin/missed-calls/:id — update pipeline status, deal value, notes
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

  const data: Record<string, unknown> = {};

  if (body.status !== undefined) {
    const status = String(body.status);
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }
    data.status = status;
  }

  if (body.dealValue !== undefined) {
    if (body.dealValue === null || body.dealValue === '') {
      data.dealValue = null;
    } else {
      const value = Number(body.dealValue);
      if (Number.isNaN(value) || value < 0) {
        return NextResponse.json({ error: 'dealValue must be a non-negative number' }, { status: 400 });
      }
      data.dealValue = value;
    }
  }

  if (body.notes !== undefined) {
    data.notes = body.notes === null ? null : String(body.notes);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const updated = await prisma.missedCall.update({ where: { id }, data });
    return NextResponse.json({ missedCall: updated });
  } catch (error: unknown) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : undefined;
    if (code === 'P2025') {
      return NextResponse.json({ error: 'Missed call not found' }, { status: 404 });
    }
    console.error('Error updating missed call:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
