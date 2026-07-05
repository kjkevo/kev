-- CreateTable BusinessConfig
CREATE TABLE "BusinessConfig" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessName" TEXT NOT NULL,
    "businessPhone" TEXT NOT NULL,
    "ownerPhone" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "missedCallMessage" TEXT NOT NULL DEFAULT 'Sorry we missed your call! {BUSINESS_NAME} will call you back shortly. Reply here if you''d like to send details now.',
    "leadSubmissionMsg" TEXT NOT NULL DEFAULT 'Hi {NAME}! Thanks for reaching out to {BUSINESS_NAME}. We got your message and will reply shortly.',
    "airtableApiKey" TEXT,
    "airtableBaseId" TEXT,
    "airtableMissedTable" TEXT,
    "airtableLeadsTable" TEXT
);

-- CreateTable MissedCall
CREATE TABLE "MissedCall" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessId" INTEGER NOT NULL,
    "callerPhone" TEXT NOT NULL,
    "callerName" TEXT,
    "missedAt" TIMESTAMP(3) NOT NULL,
    "textSentAt" TIMESTAMP(3),
    "textStatus" TEXT NOT NULL DEFAULT 'pending',
    "textResponse" TEXT,
    "twilio_call_sid" TEXT,
    "airtableId" TEXT,
    CONSTRAINT "MissedCall_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessConfig" ("id") ON DELETE CASCADE
);

-- CreateTable LeadSubmission
CREATE TABLE "LeadSubmission" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "serviceRequested" TEXT NOT NULL,
    "textSentAt" TIMESTAMP(3),
    "textStatus" TEXT NOT NULL DEFAULT 'pending',
    "textResponse" TEXT,
    "emailSentToOwner" BOOLEAN NOT NULL DEFAULT false,
    "airtableId" TEXT,
    CONSTRAINT "LeadSubmission_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessConfig" ("id") ON DELETE CASCADE
);

-- CreateIndex
CREATE INDEX "MissedCall_businessId_idx" ON "MissedCall"("businessId");

-- CreateIndex
CREATE INDEX "MissedCall_callerPhone_idx" ON "MissedCall"("callerPhone");

-- CreateIndex
CREATE INDEX "MissedCall_createdAt_idx" ON "MissedCall"("createdAt");

-- CreateIndex
CREATE INDEX "LeadSubmission_businessId_idx" ON "LeadSubmission"("businessId");

-- CreateIndex
CREATE INDEX "LeadSubmission_phone_idx" ON "LeadSubmission"("phone");

-- CreateIndex
CREATE INDEX "LeadSubmission_createdAt_idx" ON "LeadSubmission"("createdAt");

-- CreateIndex
CREATE INDEX "BusinessConfig_businessName_idx" ON "BusinessConfig"("businessName");
