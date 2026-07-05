import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  addToWaitlist,
  notifyNextOnWaitlist,
  confirmWaitlistCustomer,
  removeFromWaitlist,
} from '@/lib/waitlist';

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

    if (!data.action) {
      return NextResponse.json({ error: 'Missing required field: action' }, { status: 400 });
    }

    if (data.action === 'add') {
      const required = ['clientId', 'customerName', 'customerPhone', 'serviceType'];
      for (const field of required) {
        if (!data[field]) {
          return NextResponse.json(
            { error: `Missing required field: ${field}` },
            { status: 400 },
          );
        }
      }

      const entry = await addToWaitlist({
        clientId: data.clientId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        serviceType: data.serviceType,
      });

      return NextResponse.json(
        {
          success: true,
          waitlistId: entry.waitlistId,
          message: 'Added to waitlist',
        },
        { status: 201 },
      );
    } else if (data.action === 'notify') {
      if (!data.clientId || !data.serviceType || !data.slotDateTime) {
        return NextResponse.json(
          { error: 'Missing required fields: clientId, serviceType, slotDateTime' },
          { status: 400 },
        );
      }

      const notified = await notifyNextOnWaitlist(data.clientId, data.serviceType, data.slotDateTime);

      return NextResponse.json(
        {
          success: !!notified,
          message: notified ? `Notified ${notified.customerName}` : 'No one on waitlist',
          notifiedCustomer: notified,
        },
        { status: 200 },
      );
    } else if (data.action === 'confirm') {
      if (!data.clientId || !data.waitlistId) {
        return NextResponse.json(
          { error: 'Missing required fields: clientId, waitlistId' },
          { status: 400 },
        );
      }

      await confirmWaitlistCustomer(data.clientId, data.waitlistId);

      return NextResponse.json(
        {
          success: true,
          message: 'Waitlist customer confirmed',
        },
        { status: 200 },
      );
    } else if (data.action === 'remove') {
      if (!data.clientId || !data.waitlistId) {
        return NextResponse.json(
          { error: 'Missing required fields: clientId, waitlistId' },
          { status: 400 },
        );
      }

      await removeFromWaitlist(data.clientId, data.waitlistId);

      return NextResponse.json(
        {
          success: true,
          message: 'Removed from waitlist',
        },
        { status: 200 },
      );
    } else {
      return NextResponse.json(
        { error: `Unknown action: ${data.action}` },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error('Waitlist webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Waitlist webhook endpoint',
    actions: ['add', 'notify', 'confirm', 'remove'],
  });
}
