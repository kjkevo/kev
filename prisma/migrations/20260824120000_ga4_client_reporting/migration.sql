-- GA4 client reporting: one Ga4Client per agency client's GA4 property, with
-- weekly/monthly Ga4Snapshot rows so the report page can show trend + %
-- change, not just the latest pull.

CREATE TABLE IF NOT EXISTS "Ga4Client" (
    "id"               SERIAL PRIMARY KEY,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    "slug"             TEXT NOT NULL,
    "businessName"     TEXT NOT NULL,
    "propertyId"       TEXT,
    "timezone"         TEXT NOT NULL DEFAULT 'America/New_York',
    "active"           BOOLEAN NOT NULL DEFAULT true,
    "logoUrl"          TEXT,
    "brandColor"       TEXT NOT NULL DEFAULT '#00E5C4',
    "agencyName"       TEXT NOT NULL DEFAULT 'Your Agency',
    "recipientEmail"   TEXT,
    "deliverySchedule" TEXT NOT NULL DEFAULT 'weekly'
);

CREATE UNIQUE INDEX IF NOT EXISTS "Ga4Client_slug_key" ON "Ga4Client" ("slug");
CREATE INDEX IF NOT EXISTS "Ga4Client_active_idx" ON "Ga4Client" ("active");

CREATE TABLE IF NOT EXISTS "Ga4Snapshot" (
    "id"                   SERIAL PRIMARY KEY,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId"             INTEGER NOT NULL,
    "periodStart"          TIMESTAMP(3) NOT NULL,
    "periodEnd"            TIMESTAMP(3) NOT NULL,
    "sessions"             INTEGER NOT NULL,
    "users"                INTEGER NOT NULL,
    "conversions"          INTEGER NOT NULL,
    "engagementRate"       DOUBLE PRECISION NOT NULL,
    "sessionsChangePct"    DOUBLE PRECISION,
    "usersChangePct"       DOUBLE PRECISION,
    "conversionsChangePct" DOUBLE PRECISION,
    "channels"             JSONB NOT NULL,
    "landingPages"         JSONB NOT NULL,
    "conversionEvents"     JSONB NOT NULL,

    CONSTRAINT "Ga4Snapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Ga4Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Ga4Snapshot_clientId_periodEnd_key" ON "Ga4Snapshot" ("clientId", "periodEnd");
CREATE INDEX IF NOT EXISTS "Ga4Snapshot_clientId_periodEnd_idx" ON "Ga4Snapshot" ("clientId", "periodEnd");
