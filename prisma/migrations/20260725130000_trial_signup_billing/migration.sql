-- Stripe billing fields on a trial signup (populated on conversion to paid).
ALTER TABLE "TrialSignup"
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "plan" TEXT,
  ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "TrialSignup_stripeCustomerId_idx" ON "TrialSignup" ("stripeCustomerId");
