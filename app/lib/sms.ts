import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function sendReviewSMS(
  phoneNumber: string,
  message: string,
  ratingLink?: string
): Promise<void> {
  if (!process.env.TWILIO_PHONE_NUMBER) {
    throw new Error('TWILIO_PHONE_NUMBER is not set');
  }

  const fullMessage = ratingLink
    ? `${message}\n\nClick here to rate: ${ratingLink}`
    : message;

  // Twilio SMS limit is 160 characters, but we'll let it handle segmentation
  await client.messages.create({
    body: fullMessage.substring(0, 320), // Twilio allows concatenated messages up to 320 chars by default
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phoneNumber,
  });
}
