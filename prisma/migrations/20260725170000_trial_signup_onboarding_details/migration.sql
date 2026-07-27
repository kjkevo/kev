-- Full onboarding questionnaire answers stored as JSON.
ALTER TABLE "TrialSignup" ADD COLUMN IF NOT EXISTS "onboardingDetails" JSONB;
