-- Trial enforcement: master on/off switch + 14-day trial tracking on a business.
ALTER TABLE "BusinessConfig"
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "signupId" INTEGER,
  ADD COLUMN IF NOT EXISTS "trialReminderStage" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessConfig_signupId_key" ON "BusinessConfig" ("signupId");
