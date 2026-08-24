import { prisma } from './db';
import { pullGa4Metrics, toJson } from './ga4';
import { sendGa4ReportEmail } from './notifications';

/**
 * Shared pull logic used by both the cron route (app/api/cron/ga4-pull) and
 * the manual script (scripts/ga4-pull.ts) — one place to change if the pull
 * behavior needs to differ from the demo seed.
 */

function periodFor(deliverySchedule: string, now: Date): { start: Date; end: Date } {
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  const days = deliverySchedule === 'monthly' ? 30 : 7;
  const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { start, end };
}

export interface Ga4PullSummary {
  clientSlug: string;
  businessName: string;
  ok: boolean;
  sessions?: number;
  conversions?: number;
  error?: string;
}

export async function runGa4PullForAllClients(baseUrl: string): Promise<Ga4PullSummary[]> {
  const clients = await prisma.ga4Client.findMany({
    where: { active: true, propertyId: { not: null } },
  });

  const results: Ga4PullSummary[] = [];

  for (const c of clients) {
    try {
      const { start, end } = periodFor(c.deliverySchedule, new Date());
      const result = await pullGa4Metrics(c.propertyId!, start, end);

      await prisma.ga4Snapshot.upsert({
        where: { clientId_periodEnd: { clientId: c.id, periodEnd: end } },
        update: {
          periodStart: start,
          sessions: result.sessions,
          users: result.users,
          conversions: result.conversions,
          engagementRate: result.engagementRate,
          sessionsChangePct: result.sessionsChangePct,
          usersChangePct: result.usersChangePct,
          conversionsChangePct: result.conversionsChangePct,
          channels: toJson(result.channels),
          landingPages: toJson(result.landingPages),
          conversionEvents: toJson(result.conversionEvents),
        },
        create: {
          clientId: c.id,
          periodStart: start,
          periodEnd: end,
          sessions: result.sessions,
          users: result.users,
          conversions: result.conversions,
          engagementRate: result.engagementRate,
          sessionsChangePct: result.sessionsChangePct,
          usersChangePct: result.usersChangePct,
          conversionsChangePct: result.conversionsChangePct,
          channels: toJson(result.channels),
          landingPages: toJson(result.landingPages),
          conversionEvents: toJson(result.conversionEvents),
        },
      });

      if (c.recipientEmail) {
        await sendGa4ReportEmail(c.recipientEmail, {
          businessName: c.businessName,
          agencyName: c.agencyName,
          reportUrl: `${baseUrl}/report/${c.slug}`,
        });
      }

      results.push({
        clientSlug: c.slug,
        businessName: c.businessName,
        ok: true,
        sessions: result.sessions,
        conversions: result.conversions,
      });
    } catch (error) {
      results.push({
        clientSlug: c.slug,
        businessName: c.businessName,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
