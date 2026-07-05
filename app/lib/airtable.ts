import Airtable from 'airtable';
import { ReviewRequest, ReviewResponse, ReviewClient } from '@prisma/client';

export async function logToAirtable(
  reviewRequest: ReviewRequest & { client: ReviewClient },
  reviewResponse: ReviewResponse
): Promise<void> {
  if (!reviewRequest.client.airtableBaseId || !reviewRequest.client.airtableApiKey) {
    throw new Error('Airtable credentials not configured');
  }

  try {
    const airtable = new Airtable({
      apiKey: reviewRequest.client.airtableApiKey,
    });
    const base = airtable.base(reviewRequest.client.airtableBaseId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = base('Reviews') as any;

    // Determine public vs private feedback
    const feedbackType = reviewResponse.redirectedToPublic
      ? 'Public Review'
      : reviewResponse.sentToPrivate
      ? 'Private Feedback'
      : 'Unknown';

    // Create record
    const fields = {
      'Request ID': reviewRequest.id.toString(),
      'Customer Name': reviewRequest.customerName,
      'Customer Email': reviewRequest.customerEmail || 'N/A',
      'Customer Phone': reviewRequest.customerPhone || 'N/A',
      'Job Completed': reviewRequest.jobCompletedAt.toISOString(),
      Rating: reviewResponse.rating,
      Feedback: reviewResponse.feedbackText || 'No additional feedback',
      'Feedback Type': feedbackType,
      'Redirect URL': reviewResponse.redirectedUrl || 'N/A',
      'Responded At': reviewResponse.respondedAt.toISOString(),
      'Created At': new Date().toISOString(),
    };

    await table.create([{ fields }], { typecast: true });
  } catch (error) {
    console.error('Airtable logging error:', error);
    throw error;
  }
}
