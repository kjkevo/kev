import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/app/lib/db';
import { ReportView, type ReportSnapshot } from './ReportView';
import type { ChannelRow, ConversionEventRow, LandingPageRow } from '@/app/lib/ga4';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { slug: string };
}

async function getClientAndSnapshots(slug: string) {
  const client = await prisma.ga4Client.findUnique({ where: { slug } });
  if (!client || !client.active) return null;

  const snapshots = await prisma.ga4Snapshot.findMany({
    where: { clientId: client.id },
    orderBy: { periodEnd: 'asc' },
  });
  if (snapshots.length === 0) return null;

  return { client, snapshots };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const client = await prisma.ga4Client.findUnique({ where: { slug: params.slug } });
  return {
    title: client ? `${client.businessName} — Traffic Report` : 'Traffic Report',
    robots: { index: false, follow: false }, // client reports aren't meant to be publicly indexed
  };
}

export default async function ReportPage({ params }: PageProps) {
  const data = await getClientAndSnapshots(params.slug);
  if (!data) notFound();

  const { client, snapshots } = data;

  return (
    <ReportView
      client={{
        slug: client.slug,
        businessName: client.businessName,
        agencyName: client.agencyName,
        brandColor: client.brandColor,
        logoUrl: client.logoUrl,
        propertyId: client.propertyId,
        deliverySchedule: client.deliverySchedule,
      }}
      snapshots={snapshots.map(
        (s): ReportSnapshot => ({
          periodStart: s.periodStart.toISOString(),
          periodEnd: s.periodEnd.toISOString(),
          sessions: s.sessions,
          users: s.users,
          conversions: s.conversions,
          engagementRate: s.engagementRate,
          sessionsChangePct: s.sessionsChangePct,
          usersChangePct: s.usersChangePct,
          conversionsChangePct: s.conversionsChangePct,
          channels: s.channels as unknown as ChannelRow[],
          landingPages: s.landingPages as unknown as LandingPageRow[],
          conversionEvents: s.conversionEvents as unknown as ConversionEventRow[],
        }),
      )}
    />
  );
}
