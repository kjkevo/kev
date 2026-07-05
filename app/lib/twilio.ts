import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !twilioPhone) {
  throw new Error('Missing required Twilio environment variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER');
}

const client = twilio(accountSid, authToken);

export const sendSMS = async (toPhone: string, message: string) => {
  try {
    const result = await client.messages.create({
      from: twilioPhone,
      to: toPhone,
      body: message,
    });
    return { success: true, sid: result.sid, status: result.status };
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
};

export const generateCallResponse = (message: string) => {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(message);
  twiml.record({
    maxLength: 120,
    action: '/api/webhooks/twilio/recording-complete',
  });
  return twiml.toString();
};

export const generateMissedCallTwiML = () => {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say("Thank you for calling. We're not available right now. Please leave a message after the beep.");
  twiml.record({
    maxLength: 120,
  });
  twiml.say("Thank you for your message. We'll get back to you shortly.");
  twiml.hangup();
  return twiml.toString();
};

export const verifyTwilioSignature = (
  url: string,
  postParams: Record<string, string>,
  signature: string
): boolean => {
  return twilio.webhook(authToken, signature, url, postParams);
};
