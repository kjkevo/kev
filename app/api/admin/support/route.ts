import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';

export const dynamic = 'force-dynamic';

// GET /api/admin/support — list support tickets (newest first)
export async function GET(request: NextRequest) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const tickets = await prisma.supportTicket.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ tickets });
}
