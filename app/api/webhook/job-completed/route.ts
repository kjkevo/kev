import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { businessName, customerName, customerEmail, customerPhone, jobCompletedAt, webhookSecret } = body;

    if (!businessName || !customerName || (!customerEmail && !customerPhone)) {
      return NextResponse.json(
        { error: 'Missing required fields: businessName, customerName, and either customerEmail or customerPhone' },
        { status: 400 }
      );
    }

    // Find client by business name
    const client = await prisma.reviewClient.findFirst({
      where: { name: businessName, enabled: true },
    });

    if (!client) {
      return NextResponse.json(
        { error: `Business "${businessName}" not found or disabled` },
        { status: 404 }
      );
    }

    // Verify webhook signature if secret is provided
    if (webhookSecret && client.webhookSecret !== webhookSecret) {
      return NextResponse.json(
        { error: 'Invalid webhook secret' },
        { status: 401 }
      );
    }

    const completedAt = new Date(jobCompletedAt);
    const sendAfter = new Date(completedAt.getTime() + client.delayHours * 60 * 60 * 1000);

    // Create review request
    const reviewRequest = await prisma.reviewRequest.create({
      data: {
        clientId: client.id,
        customerName,
        customerEmail: customerEmail || null,
        customerPhone: customerPhone || null,
        jobCompletedAt: completedAt,
        sendAfter,
      },
    });

    return NextResponse.json(
      {
        success: true,
        requestId: reviewRequest.id,
        message: `Review request scheduled to be sent in ${client.delayHours} hours`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
