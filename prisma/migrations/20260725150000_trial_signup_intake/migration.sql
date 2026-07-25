-- Setup-form intake fields captured before a client starts paid service.
ALTER TABLE "TrialSignup"
  ADD COLUMN IF NOT EXISTS "servicePreference" TEXT,
  ADD COLUMN IF NOT EXISTS "exampleMessages" TEXT,
  ADD COLUMN IF NOT EXISTS "intakeSubmittedAt" TIMESTAMP(3);
