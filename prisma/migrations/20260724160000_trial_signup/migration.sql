-- Prospect businesses that sign up for a trial via the onboarding flow.
CREATE TABLE IF NOT EXISTS "TrialSignup" (
  "id"           SERIAL PRIMARY KEY,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "businessName" TEXT NOT NULL,
  "mobile"       TEXT NOT NULL,
  "email"        TEXT NOT NULL,
  "trade"        TEXT,
  "status"       TEXT NOT NULL DEFAULT 'new',
  "notes"        TEXT
);
CREATE INDEX IF NOT EXISTS "TrialSignup_createdAt_idx" ON "TrialSignup" ("createdAt");
