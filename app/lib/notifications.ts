import nodemailer from 'nodemailer';
import { sendSMS } from './twilio';
import { renderTemplate } from './config';

let emailTransporter: nodemailer.Transporter | null = null;

const initializeEmailTransporter = () => {
  if (emailTransporter) return emailTransporter;

  const emailService = process.env.EMAIL_SERVICE || 'gmail';
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;

  // Check if credentials are placeholders or missing
  const hasValidCredentials = emailUser && emailPassword &&
    !emailUser.includes('your-email') &&
    !emailPassword.includes('your-app-password');

  if (!emailUser || !emailPassword || !hasValidCredentials) {
    console.warn('Email not configured (using placeholders) - owner notifications will be mocked');
    return null;
  }

  emailTransporter = nodemailer.createTransport({
    service: emailService,
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });

  return emailTransporter;
};

// Ensures every outbound message identifies the sender and offers opt-out
// (TCPA/CTIA best practice), without duplicating it if the business already
// wrote "STOP" into their own message.
function withComplianceFooter(message: string, businessName: string): string {
  const trimmed = message.trim();
  if (/\bSTOP\b/i.test(trimmed)) return trimmed;
  const namePrefix = trimmed.toLowerCase().includes(businessName.toLowerCase())
    ? ''
    : `${businessName}: `;
  return `${trimmed}\n\n${namePrefix}Reply STOP to opt out, HELP for help.`;
}

export const sendMissedCallText = async (
  callerPhone: string,
  businessName: string,
  template: string,
  fromPhone?: string,
  recordVoicemail?: boolean,
): Promise<{ success: boolean; sid?: string; error?: string; body?: string }> => {
  const rendered = renderTemplate(template, { BUSINESS_NAME: businessName });
  // Written recording disclosure: when this business records voicemails,
  // give callers a plain-text notice too (belt-and-suspenders with the spoken
  // disclosure), unless the business already worded one into their message.
  const withDisclosure =
    recordVoicemail && !/record/i.test(rendered)
      ? `${rendered}\n\nNote: voicemails left at this number are recorded.`
      : rendered;
  try {
    const message = withComplianceFooter(withDisclosure, businessName);
    const result = await sendSMS(callerPhone, message, fromPhone);
    // Return the message minus the boilerplate footer for display purposes.
    return { success: true, sid: result.sid, body: withDisclosure };
  } catch (error) {
    console.error('Error sending missed call text:', error);
    return { success: false, error: String(error), body: withDisclosure };
  }
};

export const sendLeadConfirmationText = async (
  leadPhone: string,
  businessName: string,
  leadName: string,
  template: string,
  fromPhone?: string
): Promise<{ success: boolean; sid?: string; error?: string }> => {
  try {
    const message = withComplianceFooter(
      renderTemplate(template, { BUSINESS_NAME: businessName, NAME: leadName }),
      businessName,
    );
    const result = await sendSMS(leadPhone, message, fromPhone);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('Error sending lead confirmation text:', error);
    return { success: false, error: String(error) };
  }
};

export const sendLeadAlertToOwner = async (
  ownerEmail: string,
  businessName: string,
  lead: {
    name: string;
    phone: string;
    serviceRequested: string;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const transporter = initializeEmailTransporter();
    if (!transporter) {
      console.warn('Email transporter not initialized');
      return { success: false, error: 'Email not configured' };
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: ownerEmail,
      subject: `🔔 New Lead for ${businessName}`,
      html: `
        <h2>New Lead Received</h2>
        <p><strong>Business:</strong> ${businessName}</p>
        <p><strong>Name:</strong> ${lead.name}</p>
        <p><strong>Phone:</strong> <a href="tel:${lead.phone}">${lead.phone}</a></p>
        <p><strong>Service:</strong> ${lead.serviceRequested}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <hr />
        <p>A text message has been sent to the lead confirming receipt of their inquiry.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Error sending lead alert email:', error);
    return { success: false, error: String(error) };
  }
};

// Alert the business owner when an automatic text-back could NOT be sent, so a
// missed customer never falls through the cracks. Email is the primary channel
// because it works even when Twilio itself is the thing that's failing; a best-
// effort SMS to the owner is also attempted for immediacy. Optionally copies a
// platform-level ALERT_EMAIL so the operator sees failures across all clients.
export const sendTextFailureAlertToOwner = async (
  owner: { email: string; phone?: string },
  businessName: string,
  detail: { customerPhone: string; kind: 'missed_call' | 'lead'; error?: string }
): Promise<{ emailSent: boolean; smsSent: boolean }> => {
  const when = new Date().toLocaleString();
  const what = detail.kind === 'lead' ? 'lead confirmation text' : 'missed-call text';
  let emailSent = false;
  let smsSent = false;

  // Primary: email (independent of Twilio, so it survives a Twilio outage)
  try {
    const transporter = initializeEmailTransporter();
    if (transporter) {
      const recipients = [owner.email];
      if (process.env.ALERT_EMAIL && process.env.ALERT_EMAIL !== owner.email) {
        recipients.push(process.env.ALERT_EMAIL);
      }
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: recipients.join(', '),
        subject: `⚠️ Text-back FAILED for ${businessName} — call ${detail.customerPhone} back`,
        html: `
          <h2 style="color:#b00020">Automatic text did not send</h2>
          <p>We could not deliver the ${what} for <strong>${businessName}</strong>.
          Please reach out to this customer manually so the lead isn't lost.</p>
          <p><strong>Customer phone:</strong> <a href="tel:${detail.customerPhone}">${detail.customerPhone}</a></p>
          <p><strong>Time:</strong> ${when}</p>
          ${detail.error ? `<p><strong>Reason:</strong> ${detail.error}</p>` : ''}
          <hr />
          <p>This is an automatic reliability alert from your missed-call system.</p>
        `,
      });
      emailSent = true;
    }
  } catch (error) {
    console.error('Error sending text-failure alert email:', error);
  }

  // Best-effort: SMS the owner (may also fail if Twilio is the root cause)
  if (owner.phone) {
    try {
      await sendSMS(
        owner.phone,
        `${businessName}: we could NOT auto-text ${detail.customerPhone} after a ${detail.kind === 'lead' ? 'new lead' : 'missed call'}. Please contact them manually.`
      );
      smsSent = true;
    } catch (error) {
      console.error('Error sending text-failure alert SMS:', error);
    }
  }

  return { emailSent, smsSent };
};

export const sendMissedCallAlertToOwner = async (
  ownerEmail: string,
  businessName: string,
  call: {
    phone: string;
    name?: string;
    time: Date;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const transporter = initializeEmailTransporter();
    if (!transporter) {
      console.warn('Email transporter not initialized');
      return { success: false, error: 'Email not configured' };
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: ownerEmail,
      subject: `📞 Missed Call for ${businessName}`,
      html: `
        <h2>Missed Call Alert</h2>
        <p><strong>Business:</strong> ${businessName}</p>
        <p><strong>Caller Phone:</strong> <a href="tel:${call.phone}">${call.phone}</a></p>
        <p><strong>Caller Name:</strong> ${call.name || 'Unknown'}</p>
        <p><strong>Time:</strong> ${call.time.toLocaleString()}</p>
        <hr />
        <p>An automatic text message has been sent to the caller letting them know you'll call back soon.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Error sending missed call alert email:', error);
    return { success: false, error: String(error) };
  }
};
