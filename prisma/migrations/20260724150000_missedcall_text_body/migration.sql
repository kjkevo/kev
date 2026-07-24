-- Store the actual text-back body sent for a missed call, so the dashboard
-- shows the real (per-service) message instead of the generic template.
ALTER TABLE "MissedCall" ADD COLUMN IF NOT EXISTS "textBody" TEXT;
