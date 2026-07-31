import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { normalizePhone } from '@/app/lib/phone';
import { sendLeadConfirmationText } from '@/app/lib/notifications';

export const dynamic = 'force-dynamic';

// POST /api/opt-in — public contact form submission.
// Consent to receive texts is OPTIONAL (A2P: opt-in must be voluntary and never
// a condition of using the service). We only send a text when the visitor
// checked the (unchecked-by-default) consent box.
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const name = String(body.name ?? '').trim();
  const service = String(body.service ?? '').trim();
  const phone = normalizePhone(String(body.phone ?? ''));
  const consent = body.consent === true;

  if (!phone) {
    return NextResponse.json({ error: 'Please enter a valid US phone number.' }, { status: 400 });
  }

  try {
    // Single-tenant for now: attach to the first configured business.
    const business = await prisma.businessConfig.findFirst({ orderBy: { id: 'asc' } });
    if (!business) {
      return NextResponse.json({ error: 'No business configured.' }, { status: 503 });
    }

    const lead = await prisma.leadSubmission.create({
      data: {
        businessId: business.id,
        name: name || 'Web lead',
        phone,
        serviceRequested: service || 'General inquiry',
      },
    });

    // Only text them if they explicitly opted in (checked the consent box).
    if (consent) {
      const textResult = await sendLeadConfirmationText(
        phone,
        business.businessName,
        name || 'there',
        business.leadSubmissionMsg,
        business.businessPhone,
      );
      await prisma.leadSubmission.update({
        where: { id: lead.id },
        data: {
          textSentAt: textResult.success ? new Date() : null,
          textStatus: textResult.success ? 'sent' : 'failed',
        },
      });
    } else {
      await prisma.leadSubmission.update({
        where: { id: lead.id },
        data: { textStatus: 'skipped' },
      });
    }

    return NextResponse.json({ success: true, consented: consent });
  } catch (error) {
    console.error('Error handling opt-in:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
