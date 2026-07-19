-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorVerified" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" INTEGER,
    "meta" TEXT
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyName" TEXT NOT NULL,
    "website" TEXT,
    "contactName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "triggerEvent" TEXT NOT NULL,
    "intelligenceSummary" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "tags" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "aiScore" INTEGER,
    "aiScoreReason" TEXT,
    "aiSuggestion" TEXT,
    "dealValue" REAL,
    "source" TEXT,
    "wonAt" DATETIME,
    "lostAt" DATETIME,
    "lossReason" TEXT,
    "assignedTo" TEXT,
    "teamId" INTEGER
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leadId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "userName" TEXT,
    CONSTRAINT "Activity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomField" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "CustomFieldValue" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "leadId" INTEGER NOT NULL,
    "customFieldId" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "CustomFieldValue_customFieldId_fkey" FOREIGN KEY ("customFieldId") REFERENCES "CustomField" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomFieldValue_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Team" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "TeamMembership" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'rep',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "teamId" INTEGER,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'gray',
    "position" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "leadId" INTEGER,
    "activityId" INTEGER,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Notification_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

-- CreateTable
CREATE TABLE "MissedCall" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessId" INTEGER NOT NULL,
    "callerPhone" TEXT NOT NULL,
    "callerName" TEXT,
    "missedAt" DATETIME NOT NULL,
    "textSentAt" DATETIME,
    "textStatus" TEXT NOT NULL DEFAULT 'pending',
    "textResponse" TEXT,
    "twilio_call_sid" TEXT,
    "airtableId" TEXT,
    CONSTRAINT "MissedCall_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeadSubmission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "serviceRequested" TEXT NOT NULL,
    "textSentAt" DATETIME,
    "textStatus" TEXT NOT NULL DEFAULT 'pending',
    "textResponse" TEXT,
    "emailSentToOwner" BOOLEAN NOT NULL DEFAULT false,
    "airtableId" TEXT,
    CONSTRAINT "LeadSubmission_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_email_key" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_companyName_idx" ON "Lead"("companyName");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_teamId_idx" ON "Lead"("teamId");

-- CreateIndex
CREATE INDEX "Activity_leadId_idx" ON "Activity"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomField_name_key" ON "CustomField"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldValue_leadId_customFieldId_key" ON "CustomFieldValue"("leadId", "customFieldId");

-- CreateIndex
CREATE INDEX "TeamMembership_teamId_idx" ON "TeamMembership"("teamId");

-- CreateIndex
CREATE INDEX "TeamMembership_userId_idx" ON "TeamMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_userId_teamId_key" ON "TeamMembership"("userId", "teamId");

-- CreateIndex
CREATE INDEX "PipelineStage_userId_idx" ON "PipelineStage"("userId");

-- CreateIndex
CREATE INDEX "PipelineStage_teamId_idx" ON "PipelineStage"("teamId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "BusinessConfig_businessName_idx" ON "BusinessConfig"("businessName");

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
