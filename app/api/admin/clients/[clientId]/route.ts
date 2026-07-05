import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

function verifyAdminKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const adminKey = process.env.ADMIN_API_KEY;
  return !!adminKey && authHeader === `Bearer ${adminKey}`;
}

// GET - Get client details and stats
export async function GET(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const clientId = parseInt(params.clientId);

    const client = await prisma.reviewClient.findUnique({
      where: { id: clientId },
      include: {
        requests: {
          include: { response: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { requests: true },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Calculate stats
    const allRequests = await prisma.reviewRequest.findMany({
      where: { clientId },
      include: { response: true },
    });

    const ratedReqs = allRequests.filter((r) => r.response);
    const stats = {
      totalRequests: allRequests.length,
      sentRequests: allRequests.filter((r) => r.sent).length,
      ratedRequests: ratedReqs.length,
      averageRating:
        ratedReqs.length > 0
          ? (
              ratedReqs.reduce((sum, r) => sum + (r.response?.rating || 0), 0) /
              ratedReqs.length
            ).toFixed(2)
          : null,
      positiveRatings: ratedReqs.filter((r) => (r.response?.rating ?? 0) >= 4).length,
      negativeRatings: ratedReqs.filter((r) => (r.response?.rating ?? 0) <= 3).length,
    };

    return NextResponse.json({ client, stats }, { status: 200 });
  } catch (error) {
    console.error('Get client error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update client configuration
export async function PUT(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const clientId = parseInt(params.clientId);
    const body = await request.json();

    const updatedClient = await prisma.reviewClient.update({
      where: { id: clientId },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.businessEmail && { businessEmail: body.businessEmail }),
        ...(body.businessPhone !== undefined && { businessPhone: body.businessPhone }),
        ...(body.contactName !== undefined && { contactName: body.contactName }),
        ...(body.delayHours && { delayHours: parseInt(body.delayHours) }),
        ...(body.messageTemplate && { messageTemplate: body.messageTemplate }),
        ...(body.googleReviewUrl !== undefined && { googleReviewUrl: body.googleReviewUrl }),
        ...(body.yelpReviewUrl !== undefined && { yelpReviewUrl: body.yelpReviewUrl }),
        ...(body.airtableBaseId !== undefined && { airtableBaseId: body.airtableBaseId }),
        ...(body.airtableApiKey !== undefined && { airtableApiKey: body.airtableApiKey }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
      },
    });

    return NextResponse.json(updatedClient, { status: 200 });
  } catch (error) {
    console.error('Update client error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Disable/delete client
export async function DELETE(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const clientId = parseInt(params.clientId);

    // Soft delete by disabling
    const client = await prisma.reviewClient.update({
      where: { id: clientId },
      data: { enabled: false },
    });

    return NextResponse.json(
      { message: 'Client disabled successfully', client },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete client error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
