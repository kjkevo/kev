import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/app/lib/adminAuth';
import { sendTestEmail } from '@/app/lib/notifications';

export const dynamic = 'force-dynamic';

// POST /api/admin/test-email — admin-only. Sends a test email to ALERT_EMAIL (or
// EMAIL_USER) so the operator can confirm email works after configuring it.
export async function POST(request: NextRequest) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const result = await sendTestEmail();
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, to: result.to });
}
