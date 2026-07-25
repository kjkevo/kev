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

// Sent to the person who just signed up: warm instructions plus a big button to
// their setup form, where they tell us what service they want (voice/text/both)
// and example messages, then start service or cancel.
export const sendSignupWelcomeEmail = async (
  signup: { businessName: string; email: string },
  statusUrl: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const transporter = initializeEmailTransporter();
    if (!transporter) return { success: false, error: 'Email not configured' };
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: signup.email,
      subject: `Finish your setup for ${signup.businessName} — 2 quick minutes 📝`,
      html: `
        <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;color:#1a1a1a;line-height:1.6;">
          <h2 style="margin:0 0 8px;">You're almost there, ${signup.businessName}! 👋</h2>
          <p style="margin:0 0 16px;">Thanks for signing up. To get your missed-call text-back set up
            exactly how you want it, we just need a couple of quick answers from you.</p>

          <h3 style="margin:20px 0 6px;font-size:16px;">Here's what to do (about 2 minutes)</h3>
          <ol style="margin:0 0 16px;padding-left:20px;">
            <li>Tap the button below to open your setup form.</li>
            <li>Tell us which service you want: <strong>Voice</strong>, <strong>Text</strong>, or <strong>Both</strong>.</li>
            <li>Give us an example of the messages you'd like your customers to get.</li>
            <li>Send it to us — then, when you're ready, start your service.</li>
          </ol>

          <div style="margin:24px 0;">
            <a href="${statusUrl}" style="display:inline-block;background:#2F6BFF;color:#fff;
              text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:700;">
              Open your setup form</a>
          </div>

          <p style="margin:0 0 8px;font-size:14px;color:#555;">Not ready, or changed your mind? No
            problem and no charge — you can <a href="${statusUrl}" style="color:#2F6BFF;">cancel anytime</a>
            from that same page.</p>
          <p style="margin:16px 0 0;font-size:14px;color:#555;">Questions? Just reply to this email —
            a real person will answer.</p>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Error sending signup welcome email:', error);
    return { success: false, error: String(error) };
  }
};

// Notify the operator about a billing event (new paid conversion, payment
// failure, cancellation) so nothing slips by unseen.
export const sendBillingAlert = async (
  subject: string,
  bodyHtml: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const transporter = initializeEmailTransporter();
    if (!transporter) return { success: false, error: 'Email not configured' };
    const to = process.env.ALERT_EMAIL || process.env.EMAIL_USER;
    await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, html: bodyHtml });
    return { success: true };
  } catch (error) {
    console.error('Error sending billing alert:', error);
    return { success: false, error: String(error) };
  }
};

// Notify the operator when a trial-er cancels, so you can stop their setup.
export const sendTrialCancelledAlert = async (signup: {
  businessName: string;
  email: string;
  mobile: string;
}): Promise<{ success: boolean; error?: string }> => {
  try {
    const transporter = initializeEmailTransporter();
    if (!transporter) return { success: false, error: 'Email not configured' };
    const to = process.env.ALERT_EMAIL || process.env.EMAIL_USER;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: `⚠️ Trial cancelled: ${signup.businessName}`,
      html: `
        <h2>A trial was cancelled</h2>
        <p><strong>Business:</strong> ${signup.businessName}</p>
        <p><strong>Email:</strong> ${signup.email}</p>
        <p><strong>Mobile:</strong> ${signup.mobile}</p>
        <p>If you already provisioned them, remember to release their Twilio number so it stops billing.</p>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Error sending trial cancelled alert:', error);
    return { success: false, error: String(error) };
  }
};

// Notify the operator (you) when a prospect signs up for a trial, so you can
// provision their number and onboard them. Goes to ALERT_EMAIL if set, else the
// sending account.
export const sendTrialSignupAlert = async (signup: {
  businessName: string;
  mobile: string;
  email: string;
  trade?: string | null;
}): Promise<{ success: boolean; error?: string }> => {
  try {
    const transporter = initializeEmailTransporter();
    if (!transporter) return { success: false, error: 'Email not configured' };
    const to = process.env.ALERT_EMAIL || process.env.EMAIL_USER;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: `🚀 New trial signup: ${signup.businessName}`,
      html: `
        <h2>New trial signup</h2>
        <p><strong>Business:</strong> ${signup.businessName}</p>
        <p><strong>Mobile:</strong> <a href="tel:${signup.mobile}">${signup.mobile}</a></p>
        <p><strong>Email:</strong> <a href="mailto:${signup.email}">${signup.email}</a></p>
        ${signup.trade ? `<p><strong>What they do:</strong> ${signup.trade}</p>` : ''}
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <hr />
        <p>Next: buy them a Twilio number, point its voice + status webhooks at the app,
        and add them in <code>/admin</code>.</p>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Error sending trial signup alert:', error);
    return { success: false, error: String(error) };
  }
};

// Text a prospect (who just requested it on the landing page) a live sample of
// the text-back their own customers would get — the "instant demo text". Sent
// from the platform's default number since the prospect isn't provisioned yet.
export const sendDemoTextToProspect = async (
  mobile: string,
  businessName: string,
  trade?: string | null,
): Promise<{ success: boolean; sid?: string; error?: string }> => {
  const tradeClause = trade && trade.trim() ? ` about ${trade.trim()}` : '';
  const sample =
    `Sorry we missed your call! Thanks for reaching out to ${businessName}${tradeClause}. ` +
    `What can we help you with? We'll be right back with you.`;
  const body =
    `👋 Here's your instant demo from MissedCall — this is exactly what your ` +
    `customers get the moment they call ${businessName} and you can't pick up:\n\n` +
    `"${sample}"\n\nReply STOP to opt out, HELP for help.`;
  try {
    const result = await sendSMS(mobile, body);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('Error sending demo text to prospect:', error);
    return { success: false, error: String(error) };
  }
};

// Sent to the phone right after someone submits the trial form: a short nudge
// to go read the setup-form email we just sent them.
export const sendCheckYourEmailText = async (
  mobile: string,
  businessName: string,
): Promise<{ success: boolean; sid?: string; error?: string }> => {
  const body =
    `Thanks for signing up with MissedCall! 📧 Check your email — we just sent ` +
    `${businessName ? `${businessName} ` : ''}a quick setup form to get your service started.\n\n` +
    `Reply STOP to opt out, HELP for help.`;
  try {
    const result = await sendSMS(mobile, body);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('Error sending check-your-email text:', error);
    return { success: false, error: String(error) };
  }
};

// Notify the operator (you) when a client fills out their setup form, so you can
// build their text-back to match what they asked for.
export const sendIntakeSubmittedAlert = async (signup: {
  businessName: string;
  email: string;
  mobile: string;
  servicePreference: string;
  exampleMessages: string;
}): Promise<{ success: boolean; error?: string }> => {
  try {
    const transporter = initializeEmailTransporter();
    if (!transporter) return { success: false, error: 'Email not configured' };
    const to = process.env.ALERT_EMAIL || process.env.EMAIL_USER;
    const serviceLabel =
      signup.servicePreference === 'both'
        ? 'Voice + Text'
        : signup.servicePreference === 'voice'
          ? 'Voice'
          : 'Text';
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: `📝 Setup form submitted: ${signup.businessName}`,
      html: `
        <h2>A client filled out their setup form</h2>
        <p><strong>Business:</strong> ${signup.businessName}</p>
        <p><strong>Email:</strong> <a href="mailto:${signup.email}">${signup.email}</a></p>
        <p><strong>Mobile:</strong> <a href="tel:${signup.mobile}">${signup.mobile}</a></p>
        <p><strong>Service wanted:</strong> ${serviceLabel}</p>
        <p><strong>Example messages they'd like:</strong></p>
        <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#333;white-space:pre-wrap;">${
          signup.exampleMessages || '(none provided)'
        }</blockquote>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <hr />
        <p>Next: build their text-back to match, then they can start service (Stripe) from their setup page.</p>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Error sending intake submitted alert:', error);
    return { success: false, error: String(error) };
  }
};

// Sent to a newly-provisioned client: their dedicated number and the one
// call-forwarding step that puts them live.
export const sendProvisionedWelcome = async (
  toEmail: string,
  businessName: string,
  newNumber: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const transporter = initializeEmailTransporter();
    if (!transporter) return { success: false, error: 'Email not configured' };
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: toEmail,
      subject: `${businessName} is ready — one 2-minute step to go live`,
      html: `
        <h2>You're set up, ${businessName}! 🎉</h2>
        <p>Your dedicated MissedCall number is:</p>
        <p style="font-size:22px;font-weight:800;">${newNumber}</p>
        <p>To go live, turn on call forwarding from your business phone so calls you
          can't answer roll to this number:</p>
        <ul>
          <li><strong>When unanswered:</strong> dial <code>*71</code> then ${newNumber}</li>
          <li><strong>When busy:</strong> dial <code>*90</code> then ${newNumber}</li>
          <li><strong>When unreachable:</strong> dial <code>*92</code> then ${newNumber}</li>
        </ul>
        <p>On a VoIP or office phone system it's a settings toggle instead of a dial code —
          just reply to this email and we'll walk you through it.</p>
        <p>That's it. From then on, every missed call gets an instant text-back.</p>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Error sending provisioned welcome email:', error);
    return { success: false, error: String(error) };
  }
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
