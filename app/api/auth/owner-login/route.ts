import { NextRequest, NextResponse } from 'next/server';
import { passwordMatches, sessionToken, SESSION_COOKIE, ownerLoginConfigured } from '@/app/lib/ownerAuth';

export const dynamic = 'force-dynamic';

// POST /api/auth/owner-login — verify the owner password and set a session cookie.
export async function POST(request: NextRequest) {
  if (!ownerLoginConfigured()) {
    return NextResponse.json(
      { error: 'Login is not configured yet. Set OWNER_PASSWORD in the environment.' },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const password = String(body.password ?? '');
  if (!passwordMatches(password)) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
