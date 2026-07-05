import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !fromNumber) {
  console.warn('Twilio credentials not configured. SMS sending will be disabled.');
}

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export async function sendSMS(toNumber: string, message: string): Promise<string | null> {
  if (!client) {
    console.log(`[SMS MOCK] To: ${toNumber}, Message: ${message}`);
    return null;
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: toNumber,
    });
    return result.sid;
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
}
