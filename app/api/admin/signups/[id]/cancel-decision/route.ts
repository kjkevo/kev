import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';

export const dynamic = 'force-dynamic';

// POST /api/admin/signups/[id]/cancel-decision { decision: "confirm" | "keep" }
// Operator resolves a client's cancellation request: confirm finalizes it
// (service stays off), keep reactivates the client and turns service back on.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let decision = '';
  try {
    const body = await request.json();
    decision = String(body.decision ?? '');
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (decision !== 'confirm' && decision !== 'keep') {
    return NextResponse.json({ error: 'decision must be "confirm" or "keep"' }, { status: 400 });
  }

  const signup = await prisma.trialSignup.findUnique({ where: { id } });
  if (!signup) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (decision === 'confirm') {
    await prisma.trialSignup.update({ where: { id }, data: { status: 'cancelled' } });
    // Service already off from the request; leave it off.
    return NextResponse.json({ success: true, status: 'cancelled' });
  }

  // Keep: reactivate the client and turn their service back on.
  await prisma.trialSignup.update({ where: { id }, data: { status: 'onboarded' } });
  await prisma.businessConfig.updateMany({ where: { signupId: id }, data: { active: true } });
  return NextResponse.json({ success: true, status: 'kept' });
}
