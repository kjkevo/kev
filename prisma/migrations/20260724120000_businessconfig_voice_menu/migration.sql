-- Optional per-business keyword voice menu (spoken reply + service-specific
-- text-back). Stored as JSON: { enabled, prompt, options:[{label,keywords[],
-- reply,sms}], fallbackReply, fallbackSms }.
ALTER TABLE "BusinessConfig" ADD COLUMN IF NOT EXISTS "voiceMenu" JSONB;
