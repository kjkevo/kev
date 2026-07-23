import crypto from 'crypto';

// Simple single-owner session auth. The session cookie holds an HMAC of a
// fixed message keyed by OWNER_PASSWORD, so it's unguessable without the
// password and invalidates automatically if the password changes.

export const SESSION_COOKIE = 'owner_session';
const SESSION_MESSAGE = 'owner-session-v1';

function ownerPassword(): string {
  return process.env.OWNER_PASSWORD || '';
}

export function ownerLoginConfigured(): boolean {
  return ownerPassword().length > 0;
}

export function sessionToken(): string {
  const pw = ownerPassword() || 'unset';
  return crypto.createHmac('sha256', pw).update(SESSION_MESSAGE).digest('hex');
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function isValidSession(token: string | undefined | null): boolean {
  if (!ownerLoginConfigured() || !token) return false;
  return timingSafeEqualStr(token, sessionToken());
}

export function passwordMatches(input: string): boolean {
  if (!ownerLoginConfigured()) return false;
  return timingSafeEqualStr(input, ownerPassword());
}
