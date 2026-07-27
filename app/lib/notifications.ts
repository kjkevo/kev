import nodemailer from 'nodemailer';
import { sendSMS } from './twilio';
import { renderTemplate } from './config';
import { ONBOARDING_SECTIONS } from './onboardingSchema';

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
      subject: `Finish your setup for ${signup.businessName} — a few quick questions 📝`,
      html: `
        <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:540px;color:#1a1a1a;line-height:1.6;">
          <h2 style="margin:0 0 8px;">You're almost there, ${signup.businessName}! 👋</h2>
          <p style="margin:0 0 16px;">Thanks for signing up. To build your missed-call text-back
            exactly how you want it, we just need to learn a bit about your business.</p>

          <h3 style="margin:20px 0 6px;font-size:16px;">How it works</h3>
          <ol style="margin:0 0 16px;padding-left:20px;">
            <li><strong>Answer a few questions</strong> about your business — only the service type is required, the rest just makes your text-backs better.</li>
            <li><strong>Send it to us</strong> — we build your custom text-back.</li>
            <li><strong>Start your service</strong> when you're ready.</li>
          </ol>

          <div style="margin:24px 0;">
            <a href="${statusUrl}" style="display:inline-block;background:#2F6BFF;color:#fff;
              text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:700;">
              Open your setup form</a>
          </div>

          <h3 style="margin:20px 0 6px;font-size:16px;">Simple pricing</h3>
          <ul style="margin:0 0 16px;padding-left:20px;">
            <li>Start with a <strong>14-day free trial</strong> — <strong>no card needed</strong> to begin</li>
            <li><strong>$59.99/month</strong> for Voice or Text</li>
            <li><strong>$100/month</strong> for both Voice + Text</li>
            <li>Cancel anytime</li>
          </ul>

          <p style="margin:0 0 10px;font-size:14px;color:#555;">Not ready, or changed your mind? No
            problem and no charge:</p>
          <div style="margin:0 0 18px;">
            <a href="${statusUrl}&cancel=1" style="display:inline-block;background:#fff;border:1px solid #d9534f;
              color:#d9534f;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600;font-size:14px;">
              Cancel my plan</a>
          </div>

          <p style="margin:16px 0 0;font-size:14px;color:#555;">Questions? Just reply to this email —
            a real person will answer.</p>
          <p style="margin:16px 0 0;font-size:12px;color:#999;">
            <a href="${new URL(statusUrl).origin}/privacy" style="color:#999;">Privacy Policy</a> &nbsp;·&nbsp;
            <a href="${new URL(statusUrl).origin}/terms" style="color:#999;">Terms &amp; Conditions</a>
          </p>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Error sending signup welcome email:', error);
    return { success: false, error: String(error) };
  }
};

// Remind a trial client (no card on file) that their 14-day free trial is
// ending soon and they need to add payment to keep the service.
export const sendTrialReminderEmail = async (
  toEmail: string,
  businessName: string,
  daysLeft: number,
  addPaymentUrl: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const transporter = initializeEmailTransporter();
    if (!transporter) return { success: false, error: 'Email not configured' };
    const when = daysLeft <= 1 ? 'tomorrow' : `in ${daysLeft} days`;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: toEmail,
      subject: `Your ${businessName} free trial ends ${when} — add payment to stay live`,
      html: `
        <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;color:#1a1a1a;line-height:1.6;">
          <h2>Your free trial ends ${when}</h2>
          <p>We hope the missed-call text-back has been catching calls for <strong>${businessName}</strong>!
            To keep it running after your trial, add your payment — <strong>$59.99/month</strong> for Voice
            or Text, or <strong>$100/month</strong> for both. Cancel anytime.</p>
          <div style="margin:22px 0;">
            <a href="${addPaymentUrl}" style="display:inline-block;background:#2F6BFF;color:#fff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:700;">Add payment &amp; stay live</a>
          </div>
          <p style="font-size:14px;color:#555;">If you don't add payment, your service will simply pause when the trial ends — no charge, no hard feelings. Questions? Just reply.</p>
        </div>`,
    });
    return { success: true };
  } catch (error) {
    console.error('Error sending trial reminder email:', error);
    return { success: false, error: String(error) };
  }
};

// Tell a client their trial ended and service is paused (they never added a card).
export const sendTrialEndedEmail = async (
  toEmail: string,
  businessName: string,
  addPaymentUrl: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const transporter = initializeEmailTransporter();
    if (!transporter) return { success: false, error: 'Email not configured' };
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: toEmail,
      subject: `Your ${businessName} trial has ended — reactivate anytime`,
      html: `
        <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;color:#1a1a1a;line-height:1.6;">
          <h2>Your free trial has ended</h2>
          <p>Your missed-call text-back for <strong>${businessName}</strong> is now paused. No charge was made.</p>
          <p>Want it back on? Add payment anytime (<strong>$59.99/month</strong> for Voice or Text,
            <strong>$100/month</strong> for both — cancel anytime) and it turns right back on:</p>
          <div style="margin:22px 0;">
            <a href="${addPaymentUrl}" style="display:inline-block;background:#22C55E;color:#04220F;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:800;">Reactivate my service</a>
          </div>
          <p style="font-size:14px;color:#555;">Questions? Just reply to this email.</p>
        </div>`,
    });
    return { success: true };
  } catch (error) {
    console.error('Error sending trial ended email:', error);
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
      subject: `⚠️ Cancellation requested: ${signup.businessName}`,
      html: `
        <h2>A client requested cancellation</h2>
        <p><strong>Business:</strong> ${signup.businessName}</p>
        <p><strong>Email:</strong> ${signup.email}</p>
        <p><strong>Mobile:</strong> ${signup.mobile}</p>
        <p>Their service has been turned off. It's waiting in your dashboard under
        <strong>Cancellation requests</strong> — confirm to finalize (and release their Twilio number so it
        stops billing), or keep them and turn it back on.</p>
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

// Sends a test email so the operator can confirm email is configured correctly
// (right creds, not placeholders, provider accepts the login) with one click.
export const sendTestEmail = async (): Promise<{ success: boolean; to?: string; error?: string }> => {
  const transporter = initializeEmailTransporter();
  if (!transporter) {
    return { success: false, error: 'Email is not configured — set EMAIL_USER and EMAIL_PASSWORD (a Gmail App Password).' };
  }
  const to = process.env.ALERT_EMAIL || process.env.EMAIL_USER;
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: '✅ MissedCall email is working',
      html: `
        <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1a1a;line-height:1.6;">
          <h2>Your email is set up correctly 🎉</h2>
          <p>This is a test from your MissedCall admin. If you're reading it, then:</p>
          <ul>
            <li>Setup-form emails will reach your new signups.</li>
            <li>Signup, setup-form, cancellation, and billing alerts will reach <strong>${to}</strong>.</li>
          </ul>
          <p>Sent ${new Date().toLocaleString()}.</p>
        </div>`,
    });
    return { success: true, to: to || undefined };
  } catch (error) {
    console.error('Error sending test email:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
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
// build their text-back to match what they asked for. Renders the full
// questionnaire grouped by section, in the schema's order.
export const sendIntakeSubmittedAlert = async (signup: {
  businessName: string;
  email: string;
  mobile: string;
  servicePreference: string;
  details: Record<string, string>;
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

    const esc = (v: string) => v.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const sectionsHtml = ONBOARDING_SECTIONS.map((section) => {
      const rows = section.fields
        .filter((f) => signup.details[f.id])
        .map(
          (f) =>
            `<p style="margin:8px 0 0"><strong>${f.label}</strong><br/>
             <span style="white-space:pre-wrap;color:#333">${esc(signup.details[f.id])}</span></p>`,
        )
        .join('');
      if (!rows) return '';
      return `<h3 style="margin:18px 0 2px;font-size:15px;border-bottom:1px solid #eee;padding-bottom:4px">${section.title}</h3>${rows}`;
    }).join('');

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: `📝 Setup form submitted: ${signup.businessName}`,
      html: `
        <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:600px;color:#1a1a1a;line-height:1.5">
          <h2>A client filled out their setup form</h2>
          <p><strong>Business:</strong> ${signup.businessName}</p>
          <p><strong>Email:</strong> <a href="mailto:${signup.email}">${signup.email}</a></p>
          <p><strong>Mobile:</strong> <a href="tel:${signup.mobile}">${signup.mobile}</a></p>
          <p><strong>Service wanted:</strong> ${serviceLabel}</p>
          ${sectionsHtml || '<p><em>No additional details provided.</em></p>'}
          <p style="margin-top:16px"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          <hr />
          <p>Next: build their text-back to match, then they can start service (Stripe) from their setup page.</p>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Error sending intake submitted alert:', error);
    return { success: false, error: String(error) };
  }
};

// Sent to the client after you BUILD their service, so they can confirm it looks
// right before you start their trial.
export const sendSetupConfirmationEmail = async (opts: {
  toEmail: string;
  businessName: string;
  channel: string;
  missedCallMessage: string;
  voiceGreeting?: string;
  reviewUrl?: string;
}): Promise<{ success: boolean; error?: string }> => {
  try {
    const transporter = initializeEmailTransporter();
    if (!transporter) return { success: false, error: 'Email not configured' };
    const preview = opts.missedCallMessage.replace(/\{BUSINESS_NAME\}/g, opts.businessName);
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: opts.toEmail,
      subject: `Your ${opts.businessName} setup is ready — does this look right?`,
      html: `
        <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;color:#1a1a1a;line-height:1.6;">
          <h2>Here's your setup, ${opts.businessName} 👀</h2>
          <p>We've built your missed-call service. Take a look and reply to confirm — once you give the
            go-ahead, we'll start your <strong>14-day free trial</strong> and turn everything on.</p>
          <p><strong>Service:</strong> ${opts.channel}</p>
          <p><strong>The text your callers will get:</strong></p>
          <blockquote style="border-left:3px solid #2F6BFF;padding-left:12px;color:#333;white-space:pre-wrap;">${preview}</blockquote>
          ${opts.voiceGreeting ? `<p><strong>What callers hear:</strong></p><blockquote style="border-left:3px solid #2F6BFF;padding-left:12px;color:#333;">${opts.voiceGreeting}</blockquote>` : ''}
          ${opts.reviewUrl ? `<p><a href="${opts.reviewUrl}" style="color:#2F6BFF;">View your setup page</a></p>` : ''}
          <p style="font-size:14px;color:#555;">Want a tweak? Just reply with what to change and we'll fix it before going live.</p>
        </div>`,
    });
    return { success: true };
  } catch (error) {
    console.error('Error sending setup confirmation email:', error);
    return { success: false, error: String(error) };
  }
};

// Sent to a client when you START their trial: their dedicated number, the one
// call-forwarding step, and that their 14-day free trial is now running.
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
      subject: `${businessName} is live — your 14-day free trial has started 🎉`,
      html: `
        <h2>You're live, ${businessName}! 🎉</h2>
        <p>Your <strong>14-day free trial</strong> has started — no card needed. Here's your dedicated MissedCall number:</p>
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
