import { NextRequest, NextResponse } from 'next/server';
import { isValidSession, SESSION_COOKIE } from '@/app/lib/ownerAuth';

/**
 * Guards admin API routes. Authorized if EITHER:
 *  - the request carries a valid owner-login session cookie, or
 *  - (legacy/optional) the `x-admin-key` header matches ADMIN_API_KEY.
 *
 * Returns a NextResponse to short-circuit when unauthorized, or null to allow.
 * Fails closed: with no owner login and no admin key configured, all requests
 * are rejected.
 */
export function checkAdminAuth(request: NextRequest): NextResponse | null {
  // Preferred: owner login session
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (isValidSession(token)) return null;

  // Optional legacy fallback: shared admin key
  const configured = process.env.ADMIN_API_KEY;
  if (configured && request.headers.get('x-admin-key') === configured) return null;

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
