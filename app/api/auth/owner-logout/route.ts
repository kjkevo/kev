import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/app/lib/ownerAuth';

export const dynamic = 'force-dynamic';

// POST /api/auth/owner-logout — clear the owner session cookie.
export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
