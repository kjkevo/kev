import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import crypto from 'crypto';

// Verify admin API key
function verifyAdminKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const adminKey = process.env.ADMIN_API_KEY;
  return !!adminKey && authHeader === `Bearer ${adminKey}`;
}

// GET - List all clients
export async function GET(request: NextRequest) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const clients = await prisma.reviewClient.findMany({
      select: {
        id: true,
        name: true,
        businessEmail: true,
        contactName: true,
        delayHours: true,
        enabled: true,
        createdAt: true,
        _count: {
          select: { requests: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(clients, { status: 200 });
  } catch (error) {
    console.error('Get clients error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new client
export async function POST(request: NextRequest) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      businessEmail,
      businessPhone,
      contactName,
      delayHours = 3,
      messageTemplate,
      googleReviewUrl,
      yelpReviewUrl,
      airtableBaseId,
      airtableApiKey,
    } = body;

    if (!name || !businessEmail || !messageTemplate) {
      return NextResponse.json(
        { error: 'Missing required fields: name, businessEmail, messageTemplate' },
        { status: 400 }
      );
    }

    // Generate webhook secret
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    const client = await prisma.reviewClient.create({
      data: {
        name,
        businessEmail,
        businessPhone: businessPhone || null,
        contactName: contactName || null,
        delayHours: parseInt(delayHours) || 3,
        messageTemplate,
        googleReviewUrl: googleReviewUrl || null,
        yelpReviewUrl: yelpReviewUrl || null,
        airtableBaseId: airtableBaseId || null,
        airtableApiKey: airtableApiKey || null,
        webhookSecret,
      },
    });

    return NextResponse.json(
      {
        ...client,
        message: 'Client created successfully. Keep the webhook secret secure.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create client error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
