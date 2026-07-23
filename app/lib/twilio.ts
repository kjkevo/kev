import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

// Check if we have valid credentials (not placeholders)
const hasValidCredentials = accountSid && authToken && twilioPhone &&
  !accountSid.includes('PLACEHOLDER') &&
  !authToken.includes('placeholder');

let client: ReturnType<typeof twilio> | null = null;

if (hasValidCredentials) {
  client = twilio(accountSid, authToken);
}

// Send an SMS. In a multi-tenant setup each business texts back from its own
// Twilio number, so `fromPhone` should be the business's number; it falls back
// to the single-tenant env number when omitted.
export const sendSMS = async (toPhone: string, message: string, fromPhone?: string) => {
  const from = fromPhone || twilioPhone;

  if (!hasValidCredentials) {
    console.log(`[MOCK SMS] From: ${from}, To: ${toPhone}, Message: ${message}`);
    return { success: true, sid: 'MOCK_SID_' + Date.now(), status: 'queued' };
  }

  try {
    const result = await client!.messages.create({
      from,
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

interface MissedCallTwiMLOptions {
  greeting?: string;
  recordVoicemail?: boolean;
}

// Voice response for businesses that have voice enabled: speak the business's
// custom greeting and optionally let the caller leave a voicemail.
export const generateMissedCallTwiML = (options: MissedCallTwiMLOptions = {}) => {
  const greeting = options.greeting || "Thank you for calling. We're not available right now, but we'll text you shortly.";
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(greeting);
  if (options.recordVoicemail) {
    // Recording disclosure — required for consent in two-party-consent states.
    twiml.say("Please leave a message after the beep. Your message will be recorded.");
    twiml.record({ maxLength: 120 });
    twiml.say("Thank you for your message. We'll get back to you shortly.");
  }
  twiml.hangup();
  return twiml.toString();
};

// Response for text-only businesses: end the call immediately (no spoken
// message) so the call-status webhook fires and the text-back is sent.
export const generateTextOnlyTwiML = () => {
  const twiml = new twilio.twiml.VoiceResponse();
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
