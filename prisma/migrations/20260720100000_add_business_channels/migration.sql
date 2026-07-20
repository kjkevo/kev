-- AlterTable: per-business channel toggles + custom voice greeting
ALTER TABLE "BusinessConfig" ADD COLUMN "smsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "BusinessConfig" ADD COLUMN "voiceEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BusinessConfig" ADD COLUMN "recordVoicemail" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BusinessConfig" ADD COLUMN "voiceGreeting" TEXT NOT NULL DEFAULT 'Thank you for calling. We''re not available right now, but we''ll text you shortly.';

-- Unique index so a business can be looked up by the number that was dialed
CREATE UNIQUE INDEX "BusinessConfig_businessPhone_key" ON "BusinessConfig"("businessPhone");
