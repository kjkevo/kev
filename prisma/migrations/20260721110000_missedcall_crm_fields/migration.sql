-- Mini-CRM pipeline fields on MissedCall
ALTER TABLE "MissedCall" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'new';
ALTER TABLE "MissedCall" ADD COLUMN "dealValue" DOUBLE PRECISION;
ALTER TABLE "MissedCall" ADD COLUMN "notes" TEXT;
CREATE INDEX "MissedCall_status_idx" ON "MissedCall"("status");
