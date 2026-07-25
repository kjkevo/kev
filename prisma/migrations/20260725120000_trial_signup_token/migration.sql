-- Public token for the welcome-email status/cancel link (no login needed).
ALTER TABLE "TrialSignup" ADD COLUMN IF NOT EXISTS "token" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "TrialSignup_token_key" ON "TrialSignup" ("token");
