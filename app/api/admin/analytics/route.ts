import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

function verifyAdminKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const adminKey = process.env.ADMIN_API_KEY;
  return !!adminKey && authHeader === `Bearer ${adminKey}`;
}

export async function GET(request: NextRequest) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all requests and responses
    const allRequests = await prisma.reviewRequest.findMany({
      include: { response: true, client: true },
    });

    const allResponses = await prisma.reviewResponse.findMany({});

    // Calculate overall stats
    const totalRequests = allRequests.length;
    const sentRequests = allRequests.filter((r) => r.sent).length;
    const ratedRequests = allResponses.length;
    const responseRate = totalRequests > 0 ? ((ratedRequests / totalRequests) * 100).toFixed(2) : 0;

    const averageRating =
      allResponses.length > 0
        ? (allResponses.reduce((sum, r) => sum + r.rating, 0) / allResponses.length).toFixed(2)
        : null;

    const ratingDistribution = {
      onestar: allResponses.filter((r) => r.rating === 1).length,
      twostar: allResponses.filter((r) => r.rating === 2).length,
      threestar: allResponses.filter((r) => r.rating === 3).length,
      fourstar: allResponses.filter((r) => r.rating === 4).length,
      fivestar: allResponses.filter((r) => r.rating === 5).length,
    };

    const publicReviews = allResponses.filter((r) => r.redirectedToPublic).length;
    const privateReviews = allResponses.filter((r) => r.sentToPrivate).length;

    // Client breakdown
    const clientStats = await Promise.all(
      (
        await prisma.reviewClient.findMany()
      ).map(async (client) => {
        const clientRequests = allRequests.filter((r) => r.clientId === client.id);
        const clientResponses = allResponses.filter((r) =>
          clientRequests.find((req) => req.id === r.requestId)
        );

        return {
          clientId: client.id,
          clientName: client.name,
          totalRequests: clientRequests.length,
          sentRequests: clientRequests.filter((r) => r.sent).length,
          ratedRequests: clientResponses.length,
          averageRating:
            clientResponses.length > 0
              ? (clientResponses.reduce((sum, r) => sum + r.rating, 0) / clientResponses.length).toFixed(2)
              : null,
        };
      })
    );

    return NextResponse.json(
      {
        overall: {
          totalRequests,
          sentRequests,
          ratedRequests,
          responseRate,
          averageRating,
          ratingDistribution,
          publicReviews,
          privateReviews,
        },
        byClient: clientStats,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
