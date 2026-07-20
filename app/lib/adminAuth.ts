import { NextRequest, NextResponse } from 'next/server';

/**
 * Guards admin API routes with a shared secret. The caller must send the key
 * in the `x-admin-key` header, matching the ADMIN_API_KEY environment variable.
 *
 * Returns a NextResponse to short-circuit the request when unauthorized, or
 * null when the request is allowed to proceed. Fails closed: if ADMIN_API_KEY
 * is not configured, all requests are rejected.
 */
export function checkAdminAuth(request: NextRequest): NextResponse | null {
  const configured = process.env.ADMIN_API_KEY;
  if (!configured) {
    return NextResponse.json(
      { error: 'Admin API is not configured. Set ADMIN_API_KEY in the environment.' },
      { status: 503 }
    );
  }

  const provided = request.headers.get('x-admin-key');
  if (!provided || provided !== configured) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
