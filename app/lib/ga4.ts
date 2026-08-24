/**
 * GA4 Data API integration for the client reporting dashboard.
 *
 * Auth: a Google service account, shared as a "Viewer" on each client's GA4
 * property (Admin → Property access management → add the service account's
 * email). Credentials come from GA4_SERVICE_ACCOUNT_KEY — the full service
 * account JSON, either raw or base64-encoded — so no OAuth consent screen or
 * per-client login flow is needed. See docs/GA4_REPORTING.md for setup.
 *
 * The demo client (slug "demo", propertyId null) never calls this API — it's
 * seeded with sample data by scripts/seed-ga4-demo.ts so the report can be
 * shown to prospects before any real GA4 access exists.
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import type { Prisma } from '@prisma/client';

export interface ChannelRow {
  channel: string;
  sessions: number;
  users: number;
  conversions: number;
}

export interface LandingPageRow {
  path: string;
  sessions: number;
  conversions: number;
  conversionRate: number; // 0-1
}

export interface ConversionEventRow {
  eventName: string;
  count: number;
}

export interface Ga4PullResult {
  sessions: number;
  users: number;
  conversions: number;
  engagementRate: number;
  sessionsChangePct: number | null;
  usersChangePct: number | null;
  conversionsChangePct: number | null;
  channels: ChannelRow[];
  landingPages: LandingPageRow[];
  conversionEvents: ConversionEventRow[];
}

// Week-over-week / month-over-month % change, null when there's no prior
// period to compare against (a client's first pull) or the prior value was 0
// (a % change against zero is undefined, not infinite or 0).
export function computeChangePct(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// Prisma's Json input type requires an index-signature-compatible shape,
// which our concrete row interfaces don't structurally satisfy in TS even
// though they're plain JSON at runtime — this is just the cast Prisma expects.
export function toJson<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

let client: BetaAnalyticsDataClient | null = null;

function getClient(): BetaAnalyticsDataClient {
  if (client) return client;

  const raw = process.env.GA4_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      'GA4_SERVICE_ACCOUNT_KEY is not set. Add the service-account JSON (raw or base64) to your env — see docs/GA4_REPORTING.md.',
    );
  }
  const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const credentials = JSON.parse(json);

  client = new BetaAnalyticsDataClient({ credentials });
  return client;
}

const dateStr = (d: Date) => d.toISOString().slice(0, 10);

// Pulls the full report bundle for one GA4 property over [periodStart, periodEnd],
// comparing against the immediately preceding period of equal length.
export async function pullGa4Metrics(
  propertyId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<Ga4PullResult> {
  const ga4 = getClient();
  const lengthMs = periodEnd.getTime() - periodStart.getTime();
  const prevEnd = new Date(periodStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - lengthMs);

  const currentRange = { startDate: dateStr(periodStart), endDate: dateStr(periodEnd) };
  const previousRange = { startDate: dateStr(prevStart), endDate: dateStr(prevEnd) };

  // Overview: sessions/users/conversions/engagement rate, current + previous period
  // in one call via GA4's built-in date-range comparison.
  const [overview] = await ga4.runReport({
    property: propertyId,
    dateRanges: [currentRange, previousRange],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'keyEvents' }, // GA4's current name for conversions
      { name: 'engagementRate' },
    ],
  });

  const curRow = overview.rows?.[0]?.metricValues;
  const prevRow = overview.rows?.[1]?.metricValues;
  const sessions = Number(curRow?.[0]?.value ?? 0);
  const users = Number(curRow?.[1]?.value ?? 0);
  const conversions = Number(curRow?.[2]?.value ?? 0);
  const engagementRate = Number(curRow?.[3]?.value ?? 0);
  const prevSessions = prevRow ? Number(prevRow[0]?.value ?? 0) : null;
  const prevUsers = prevRow ? Number(prevRow[1]?.value ?? 0) : null;
  const prevConversions = prevRow ? Number(prevRow[2]?.value ?? 0) : null;

  // Channels
  const [channelReport] = await ga4.runReport({
    property: propertyId,
    dateRanges: [currentRange],
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'keyEvents' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  });
  const channels: ChannelRow[] = (channelReport.rows ?? []).map((row) => ({
    channel: row.dimensionValues?.[0]?.value ?? 'Unknown',
    sessions: Number(row.metricValues?.[0]?.value ?? 0),
    users: Number(row.metricValues?.[1]?.value ?? 0),
    conversions: Number(row.metricValues?.[2]?.value ?? 0),
  }));

  // Top landing pages
  const [landingReport] = await ga4.runReport({
    property: propertyId,
    dateRanges: [currentRange],
    dimensions: [{ name: 'landingPagePlusQueryString' }],
    metrics: [{ name: 'sessions' }, { name: 'keyEvents' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  });
  const landingPages: LandingPageRow[] = (landingReport.rows ?? []).map((row) => {
    const pageSessions = Number(row.metricValues?.[0]?.value ?? 0);
    const pageConversions = Number(row.metricValues?.[1]?.value ?? 0);
    return {
      path: row.dimensionValues?.[0]?.value ?? '/',
      sessions: pageSessions,
      conversions: pageConversions,
      conversionRate: pageSessions > 0 ? pageConversions / pageSessions : 0,
    };
  });

  // Conversion (key) events
  const [eventReport] = await ga4.runReport({
    property: propertyId,
    dateRanges: [currentRange],
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: { fieldName: 'isKeyEvent', stringFilter: { value: 'true' } },
    },
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 10,
  });
  const conversionEvents: ConversionEventRow[] = (eventReport.rows ?? []).map((row) => ({
    eventName: row.dimensionValues?.[0]?.value ?? 'event',
    count: Number(row.metricValues?.[0]?.value ?? 0),
  }));

  return {
    sessions,
    users,
    conversions,
    engagementRate,
    sessionsChangePct: computeChangePct(sessions, prevSessions),
    usersChangePct: computeChangePct(users, prevUsers),
    conversionsChangePct: computeChangePct(conversions, prevConversions),
    channels,
    landingPages,
    conversionEvents,
  };
}
