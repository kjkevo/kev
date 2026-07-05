import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendReviewEmail(
  to: string,
  message: string,
  ratingLink: string
): Promise<void> {
  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>How was your service?</h2>
      <p>${message.replace(/\n/g, '<br>')}</p>
      <p style="margin: 30px 0;">
        <a href="${ratingLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Leave a Rating
        </a>
      </p>
      <p style="color: #666; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
    </div>
  `;

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'noreply@resend.dev',
    to,
    subject: 'We\'d love your feedback on our service',
    html: htmlContent,
  });
}

export async function sendPrivateFeedbackEmail(
  to: string,
  businessName: string,
  customerName: string,
  rating: number,
  feedbackText: string
): Promise<void> {
  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>New Feedback from ${customerName}</h2>
      <p><strong>Rating:</strong> ${rating} out of 5 stars</p>
      ${feedbackText ? `<p><strong>Feedback:</strong><br>${feedbackText.replace(/\n/g, '<br>')}</p>` : ''}
      <p style="color: #666; font-size: 12px; margin-top: 30px;">This is an automated message. Please reach out to this customer to address their concerns or thank them for their positive feedback.</p>
    </div>
  `;

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'noreply@resend.dev',
    to,
    subject: `New ${rating}-star feedback from customer`,
    html: htmlContent,
  });
}
