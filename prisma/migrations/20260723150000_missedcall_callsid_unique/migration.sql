-- Idempotency: a Twilio CallSid uniquely identifies a call, so at most one
-- MissedCall may exist per SID. This prevents the call-status webhook from
-- creating duplicate records (and sending duplicate texts) when Twilio
-- re-delivers the webhook.
CREATE UNIQUE INDEX IF NOT EXISTS "MissedCall_twilio_call_sid_key"
  ON "MissedCall" ("twilio_call_sid");
