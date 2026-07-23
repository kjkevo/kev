import { NextRequest, NextResponse } from 'next/server';
import { loadBusinessConfig, validateConfig } from '@/app/lib/config';
import { sendLeadConfirmationText, sendLeadAlertToOwner, sendTextFailureAlertToOwner } from '@/app/lib/notifications';
import { logLeadToAirtable } from '@/app/lib/airtable';
import { prisma } from '@/app/lib/db';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Validate required fields
    const { name, phone, serviceRequested, businessId } = payload;
    if (!name || !phone || !serviceRequested) {
      return NextResponse.json(
        { error: 'Missing required fields: name, phone, serviceRequested' },
        { status: 400 }
      );
    }

    // Load business config
    const config = await loadBusinessConfig(businessId);
    const configErrors = validateConfig(config);
    if (configErrors.length > 0) {
      console.error('Invalid config:', configErrors);
      return NextResponse.json({ error: 'Invalid config' }, { status: 500 });
    }

    console.log(`New lead received: ${name} (${phone}) for ${serviceRequested}`);

    // Send text to lead
    const textResult = await sendLeadConfirmationText(
      phone,
      config.businessName,
      name,
      config.leadSubmissionMsg
    );

    // Log to database
    const leadSubmission = await prisma.leadSubmission.create({
      data: {
        businessId: config.id,
        name,
        phone,
        serviceRequested,
        textSentAt: textResult.success ? new Date() : undefined,
        textStatus: textResult.success ? 'sent' : 'failed',
      },
    });

    // Log to Airtable (async, don't await)
    const airtableConfig = {
      apiKey: config.airtableApiKey || '',
      baseId: config.airtableBaseId || '',
      tableId: config.airtableLeadsTable || '',
    };

    logLeadToAirtable(airtableConfig, {
      businessName: config.businessName,
      name,
      phone,
      serviceRequested,
      textSent: textResult.success,
    })
      .then((airtableId) => {
        if (airtableId) {
          prisma.leadSubmission.update({
            where: { id: leadSubmission.id },
            data: { airtableId },
          }).catch(console.error);
        }
      })
      .catch(console.error);

    // If the confirmation text failed, alert the owner to follow up manually.
    if (!textResult.success) {
      sendTextFailureAlertToOwner(
        { email: config.ownerEmail, phone: config.ownerPhone },
        config.businessName,
        { customerPhone: phone, kind: 'lead', error: textResult.error },
      ).catch(console.error);
    }

    // Send email alert to owner (async, don't wait for response)
    sendLeadAlertToOwner(config.ownerEmail, config.businessName, {
      name,
      phone,
      serviceRequested,
    })
      .then((result) => {
        if (result.success) {
          prisma.leadSubmission.update({
            where: { id: leadSubmission.id },
            data: { emailSentToOwner: true },
          }).catch(console.error);
        }
      })
      .catch(console.error);

    return NextResponse.json(
      {
        success: true,
        recordId: leadSubmission.id,
        textSent: textResult.success,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error handling lead submission:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
