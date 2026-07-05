import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { markAsNoshow } from '@/lib/appointments';

const WEBHOOK_SECRET = process.env.APPOINTMENT_WEBHOOK_SECRET || 'dev-secret';

function verifyWebhookSignature(payload: string, signature: string): boolean {
  const hash = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
  return hash === signature;
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get('x-appointment-signature');

    if (!signature || !verifyWebhookSignature(payload, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const data = JSON.parse(payload);

    if (!data.clientId || !data.appointmentId) {
      return NextResponse.json(
        { error: 'Missing required fields: clientId, appointmentId' },
        { status: 400 },
      );
    }

    await markAsNoshow(data.clientId, data.appointmentId);

    return NextResponse.json(
      {
        success: true,
        message: 'Appointment marked as no-show and follow-up text sent',
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('No-show webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'No-show webhook endpoint. Use POST to mark appointments as no-show.',
  });
}
