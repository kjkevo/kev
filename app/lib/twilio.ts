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

// One-click provisioning: find and buy a US local number, wired to this app's
// webhooks (voice, call-status, inbound SMS). `areaCode` is a preference — if no
// number is available there, we fall back to any US local number. In mock mode
// (no real Twilio creds) we return a fake number so the flow stays testable.
export const provisionNumber = async (opts: {
  areaCode?: string;
  voiceUrl: string;
  statusCallbackUrl: string;
  smsUrl: string;
  friendlyName?: string;
}): Promise<{ success: boolean; phoneNumber?: string; sid?: string; mock?: boolean; error?: string }> => {
  if (!hasValidCredentials) {
    const fake = `+1555${Math.floor(1000000 + Math.random() * 8999999)}`;
    console.log(`[MOCK PROVISION] Would buy a number (${opts.areaCode ?? 'any'}) → ${fake}`);
    return { success: true, phoneNumber: fake, sid: 'PN_MOCK_' + Date.now(), mock: true };
  }

  try {
    // Prefer a number local to the prospect's own area code, then fall back.
    const search = async (areaCode?: string) =>
      client!.availablePhoneNumbers('US').local.list({
        ...(areaCode ? { areaCode: Number(areaCode) } : {}),
        smsEnabled: true,
        voiceEnabled: true,
        limit: 1,
      });

    let candidates = opts.areaCode ? await search(opts.areaCode) : [];
    if (candidates.length === 0) candidates = await search();
    if (candidates.length === 0) {
      return { success: false, error: 'No US phone numbers are currently available to purchase.' };
    }

    const purchased = await client!.incomingPhoneNumbers.create({
      phoneNumber: candidates[0].phoneNumber,
      friendlyName: opts.friendlyName,
      voiceUrl: opts.voiceUrl,
      voiceMethod: 'POST',
      statusCallback: opts.statusCallbackUrl,
      statusCallbackMethod: 'POST',
      smsUrl: opts.smsUrl,
      smsMethod: 'POST',
    });
    return { success: true, phoneNumber: purchased.phoneNumber, sid: purchased.sid };
  } catch (error) {
    console.error('Error provisioning Twilio number:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
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
    // Spoken recording disclosure, played BEFORE any audio is captured so the
    // caller can consent (or opt out) first — required in two-party-consent
    // states. The caller is given a clear way to avoid being recorded.
    twiml.say(
      "Please note: your voicemail will be recorded so we can follow up. " +
      "If you do not wish to be recorded, you can hang up now and text us instead. " +
      "To leave a recorded message, please speak after the beep."
    );
    twiml.record({ maxLength: 120, playBeep: true });
    twiml.say("Thank you for your message. We'll get back to you shortly.");
  }
  twiml.hangup();
  return twiml.toString();
};

// Keyword voice menu: speak a prompt and listen for the caller's spoken answer
// (or a keypad digit). Twilio POSTs the result to `actionUrl`, where we match a
// keyword and respond. If the caller says nothing, we redirect to the same
// handler with no input so it can send a fallback text.
export const generateVoiceMenuTwiML = (opts: {
  prompt: string;
  hints?: string;
  actionUrl: string;
}) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const gather = twiml.gather({
    input: 'dtmf speech' as unknown as ('speech' | 'dtmf')[],
    action: opts.actionUrl,
    method: 'POST',
    speechTimeout: 'auto',
    timeout: 6,
    numDigits: 1,
    ...(opts.hints ? { hints: opts.hints } : {}),
  });
  gather.say(opts.prompt);
  // No input captured -> fall through to the handler for the fallback path.
  twiml.redirect({ method: 'POST' }, opts.actionUrl);
  return twiml.toString();
};

// Speak a reply and end the call (used after a menu selection).
export const generateSpokenReplyTwiML = (reply: string) => {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(reply);
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
