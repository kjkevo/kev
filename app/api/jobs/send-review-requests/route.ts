import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { sendReviewEmail } from '@/app/lib/email';
import { sendReviewSMS } from '@/app/lib/sms';

// This endpoint should be called by a cron job (Vercel Crons, AWS Lambda, etc.)
// Protect with an API key to prevent unauthorized access
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const apiKey = process.env.REVIEW_JOB_API_KEY;

    if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();

    // Find all review requests that should be sent
    const pendingRequests = await prisma.reviewRequest.findMany({
      where: {
        sent: false,
        sendAfter: {
          lte: now,
        },
      },
      include: {
        client: true,
      },
    });

    console.log(`Found ${pendingRequests.length} pending review requests`);

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    for (const reviewRequest of pendingRequests) {
      try {
        const ratingLink = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/rate/${reviewRequest.id}`;

        const messageContent = reviewRequest.client.messageTemplate
          .replace('{link}', ratingLink)
          .replace('{customerName}', reviewRequest.customerName)
          .replace('{businessName}', reviewRequest.client.name);

        let sent = false;

        // Send email if available
        if (reviewRequest.customerEmail) {
          try {
            await sendReviewEmail(reviewRequest.customerEmail, messageContent, ratingLink);
            sent = true;
          } catch (err) {
            console.error(`Failed to send email to ${reviewRequest.customerEmail}:`, err);
            errors.push(`Email failed for request ${reviewRequest.id}: ${err}`);
          }
        }

        // Send SMS if email failed and phone is available
        if (!sent && reviewRequest.customerPhone) {
          try {
            await sendReviewSMS(reviewRequest.customerPhone, messageContent);
            sent = true;
          } catch (err) {
            console.error(`Failed to send SMS to ${reviewRequest.customerPhone}:`, err);
            errors.push(`SMS failed for request ${reviewRequest.id}: ${err}`);
          }
        }

        if (sent) {
          // Mark as sent
          await prisma.reviewRequest.update({
            where: { id: reviewRequest.id },
            data: {
              sent: true,
              sentAt: new Date(),
            },
          });
          successCount++;
        } else {
          failureCount++;
          errors.push(`No contact method available for request ${reviewRequest.id}`);
        }
      } catch (err) {
        failureCount++;
        errors.push(`Request ${reviewRequest.id} processing error: ${err}`);
      }
    }

    return NextResponse.json(
      {
        success: true,
        processed: pendingRequests.length,
        successCount,
        failureCount,
        errors: errors.length > 0 ? errors : undefined,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Job execution error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
