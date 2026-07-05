import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { logToAirtable } from '@/app/lib/airtable';
import { sendPrivateFeedbackEmail } from '@/app/lib/email';

// GET endpoint to fetch client info for rating page
export async function GET(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const reviewRequest = await prisma.reviewRequest.findUnique({
      where: { id: parseInt(params.requestId) },
      include: { client: true },
    });

    if (!reviewRequest) {
      return NextResponse.json(
        { error: 'Review request not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        businessName: reviewRequest.client.name,
        businessEmail: reviewRequest.client.businessEmail,
        customerName: reviewRequest.customerName,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching review request info:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const { rating, feedbackText } = await request.json();

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Find the review request
    const reviewRequest = await prisma.reviewRequest.findUnique({
      where: { id: parseInt(params.requestId) },
      include: { client: true, response: true },
    });

    if (!reviewRequest) {
      return NextResponse.json(
        { error: 'Review request not found' },
        { status: 404 }
      );
    }

    // Check if already responded
    if (reviewRequest.response) {
      return NextResponse.json(
        { error: 'You have already submitted a rating for this review' },
        { status: 409 }
      );
    }

    let redirectedToPublic = false;
    let redirectedUrl = null;
    let sentToPrivate = false;

    // Determine routing based on rating
    if (rating >= 4) {
      // High rating: send to public review site
      redirectedToPublic = true;
      redirectedUrl = reviewRequest.client.googleReviewUrl || reviewRequest.client.yelpReviewUrl || '';
    } else {
      // Low rating: send to private form
      sentToPrivate = true;

      // Send email to business owner with feedback
      if (reviewRequest.client.businessEmail) {
        try {
          await sendPrivateFeedbackEmail(
            reviewRequest.client.businessEmail,
            reviewRequest.client.name,
            reviewRequest.customerName,
            rating,
            feedbackText || ''
          );
        } catch (err) {
          console.error('Failed to send private feedback email:', err);
          // Continue anyway - don't fail the entire request
        }
      }
    }

    // Create review response
    const response = await prisma.reviewResponse.create({
      data: {
        requestId: reviewRequest.id,
        rating,
        feedbackText: feedbackText || null,
        redirectedToPublic,
        redirectedUrl: redirectedUrl || null,
        sentToPrivate,
        privateEmailSentAt: sentToPrivate ? new Date() : null,
      },
    });

    // Log to Airtable
    if (reviewRequest.client.airtableBaseId && reviewRequest.client.airtableApiKey) {
      try {
        await logToAirtable(reviewRequest, response);
      } catch (err) {
        console.error('Failed to log to Airtable:', err);
        // Continue anyway
      }
    }

    return NextResponse.json(
      {
        success: true,
        rating,
        redirectUrl: redirectedUrl,
        redirectedToPublic,
        message: redirectedToPublic
          ? 'Thank you for the great feedback! Redirecting to review site...'
          : 'Thank you for your feedback. The business owner will contact you shortly.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Rating submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
