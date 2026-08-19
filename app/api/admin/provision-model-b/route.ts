import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';
import { provisionNumber, attachToMessagingService } from '@/app/lib/twilio';

export const dynamic = 'force-dynamic';

// POST /api/admin/provision-model-b — one-click "get a Model B number": buy a
// Twilio number, wire its webhooks to this app, and create a business line that
// rings `ringPhone` first and texts back on a miss. Body: { ringPhone, label?,
// areaCode? }.
export async function POST(request: NextRequest) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const ringPhone = typeof body.ringPhone === 'string' ? body.ringPhone.trim() : '';
  const label = (typeof body.label === 'string' && body.label.trim()) ? body.label.trim() : 'My Slimpse Line';
  const areaCode = typeof body.areaCode === 'string' && /^\d{3}$/.test(body.areaCode) ? body.areaCode : undefined;
  if (!ringPhone) return NextResponse.json({ error: 'A phone number to ring is required.' }, { status: 400 });

  const origin = new URL(request.url).origin;
  const result = await provisionNumber({
    areaCode,
    voiceUrl: `${origin}/api/webhooks/twilio/incoming-call`,
    statusCallbackUrl: `${origin}/api/webhooks/twilio/call-status`,
    smsUrl: `${origin}/api/webhooks/twilio/sms-inbound`,
    friendlyName: label,
  });
  if (!result.success || !result.phoneNumber) {
    return NextResponse.json({ error: result.error || 'Could not provision a number.' }, { status: 502 });
  }
  if (result.sid) await attachToMessagingService(result.sid).catch(() => {});

  const ownerEmail = process.env.ALERT_EMAIL || process.env.EMAIL_USER || 'hello@slimpse.com';
  try {
    const biz = await prisma.businessConfig.create({
      data: {
        businessName: label,
        businessPhone: result.phoneNumber,
        ownerPhone: ringPhone,
        ownerEmail,
        smsEnabled: true,
        voiceEnabled: false,
        ringPhone,
        active: true,
      },
    });
    return NextResponse.json({ success: true, phoneNumber: result.phoneNumber, businessId: biz.id, mock: Boolean(result.mock) });
  } catch (error) {
    console.error('Error creating Model B business:', error);
    return NextResponse.json({ error: `Number ${result.phoneNumber} was bought, but creating the line failed. Add it manually.` }, { status: 500 });
  }
}
