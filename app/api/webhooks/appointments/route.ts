import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAppointment } from '@/lib/appointments';

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

    // Validate required fields
    const required = ['clientId', 'customerName', 'customerPhone', 'appointmentDateTime', 'serviceType'];
    for (const field of required) {
      if (!data[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 },
        );
      }
    }

    const appointment = await createAppointment({
      clientId: data.clientId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      appointmentDateTime: data.appointmentDateTime,
      serviceType: data.serviceType,
    });

    return NextResponse.json(
      {
        success: true,
        appointmentId: appointment.appointmentId,
        message: 'Appointment created and confirmation text sent',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Appointment webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Appointment webhook endpoint. Use POST to create appointments.' });
}
