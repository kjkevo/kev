'use client';

import * as React from 'react';
import { Card, CardTitle, CardDescription } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { TrendChart } from './TrendChart';
import { BarList } from './BarList';
import { formatChangePct, formatDateRange, formatLabel, formatNumber, formatPct } from './format';
import type { ChannelRow, ConversionEventRow, LandingPageRow } from '@/app/lib/ga4';

export interface ReportClient {
  slug: string;
  businessName: string;
  agencyName: string;
  brandColor: string;
  logoUrl: string | null;
  propertyId: string | null;
  deliverySchedule: string;
}

export interface ReportSnapshot {
  periodStart: string;
  periodEnd: string;
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

interface ReportViewProps {
  client: ReportClient;
  snapshots: ReportSnapshot[]; // ascending by periodEnd, always at least 1
}

function KpiTile({
  label,
  value,
  changePct,
  color,
}: {
  label: string;
  value: string;
  changePct: number | null;
  color: string;
}) {
  const isUp = changePct !== null && changePct > 0;
  const isDown = changePct !== null && changePct < 0;
  return (
    <Card>
      <div className="text-xs font-medium uppercase tracking-wide text-[#64748B]">{label}</div>
      <div className="mt-1.5 font-mono text-2xl font-semibold text-white tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="mt-1.5">
        <Badge variant={isUp ? 'success' : isDown ? 'danger' : 'neutral'}>
          {isUp ? '↑' : isDown ? '↓' : '–'} {formatChangePct(changePct)}
        </Badge>
        <span className="ml-2 text-[11px] text-[#64748B]">vs prior period</span>
      </div>
    </Card>
  );
}

export function ReportView({ client, snapshots }: ReportViewProps) {
  const latest = snapshots[snapshots.length - 1];
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const engagementChangePct =
    previous && previous.engagementRate > 0
      ? ((latest.engagementRate - previous.engagementRate) / previous.engagementRate) * 100
      : null;

  const topChannels = [...latest.channels].sort((a, b) => b.sessions - a.sessions).slice(0, 6);
  const topEvents = [...latest.conversionEvents].sort((a, b) => b.count - a.count).slice(0, 6);
  const topPages = [...latest.landingPages].sort((a, b) => b.sessions - a.sessions).slice(0, 8);

  return (
    <div className="min-h-screen bg-[#05080F] px-4 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-[880px]">
        {!client.propertyId && (
          <div className="mb-6 rounded-lg border border-[rgba(0,229,196,0.2)] bg-[rgba(0,229,196,0.08)] px-4 py-2.5 text-sm text-[#66F0DC]">
            Sample data — this is exactly what {client.businessName}&rsquo;s live report would look like once connected to GA4.
          </div>
        )}

        {/* ── Header ── */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#64748B]">
              {client.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={client.logoUrl} alt={client.agencyName} className="h-4 w-auto" />
              ) : null}
              Powered by {client.agencyName}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{client.businessName}</h1>
            <p className="mt-1 text-sm text-[#94A3B8]">
              Traffic overview · {formatDateRange(latest.periodStart, latest.periodEnd)}
            </p>
          </div>
          <div className="text-right text-xs text-[#64748B]">
            Updated {new Date(latest.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            <br />
            {client.deliverySchedule === 'monthly' ? 'Monthly report' : 'Weekly report'}
          </div>
        </div>

        {/* ── KPI row ── */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiTile label="Sessions" value={formatNumber(latest.sessions)} changePct={latest.sessionsChangePct} color={client.brandColor} />
          <KpiTile label="Users" value={formatNumber(latest.users)} changePct={latest.usersChangePct} color="#94A3B8" />
          <KpiTile label="Conversions" value={formatNumber(latest.conversions)} changePct={latest.conversionsChangePct} color="#34D399" />
          <KpiTile label="Engagement rate" value={formatPct(latest.engagementRate * 100)} changePct={engagementChangePct} color="#38BDF8" />
        </div>

        {/* ── Trend ── */}
        <Card className="mb-6">
          <CardTitle>Sessions &amp; users over time</CardTitle>
          <CardDescription className="mb-3">
            {snapshots.length} {client.deliverySchedule === 'monthly' ? 'months' : 'weeks'} of history
          </CardDescription>
          <TrendChart
            color={client.brandColor}
            points={snapshots.map((s) => ({ periodEnd: s.periodEnd, sessions: s.sessions, users: s.users }))}
          />
        </Card>

        {/* ── Channels + conversions ── */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card>
            <CardTitle>Top channels</CardTitle>
            <CardDescription className="mb-3">Sessions by traffic source</CardDescription>
            <BarList
              color={client.brandColor}
              items={topChannels.map((c) => ({
                label: c.channel,
                value: c.sessions,
                detail: `${formatNumber(c.users)} users · ${formatNumber(c.conversions)} conversions`,
              }))}
            />
          </Card>
          <Card>
            <CardTitle>Conversion events</CardTitle>
            <CardDescription className="mb-3">What&rsquo;s converting</CardDescription>
            {topEvents.length > 0 ? (
              <BarList color="#34D399" items={topEvents.map((e) => ({ label: e.eventName, value: e.count }))} />
            ) : (
              <p className="text-sm text-[#64748B]">No conversion events configured yet.</p>
            )}
          </Card>
        </div>

        {/* ── Top landing pages ── */}
        <Card noPadding className="mb-8">
          <div className="px-5 py-4">
            <CardTitle>Top landing pages</CardTitle>
            <CardDescription>Where sessions land first</CardDescription>
          </div>
          <div className="overflow-x-auto border-t border-white/[0.06]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-[#64748B]">
                  <th className="px-5 py-2.5 font-medium">Page</th>
                  <th className="px-5 py-2.5 text-right font-medium">Sessions</th>
                  <th className="px-5 py-2.5 text-right font-medium">Conversions</th>
                  <th className="px-5 py-2.5 text-right font-medium">Conv. rate</th>
                </tr>
              </thead>
              <tbody>
                {topPages.map((p) => (
                  <tr key={p.path} className="border-t border-white/[0.05]">
                    <td className="max-w-[280px] truncate px-5 py-2.5 font-mono text-[#CBD5E1]">{p.path}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-white">{formatNumber(p.sessions)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-white">{formatNumber(p.conversions)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-[#94A3B8]">{formatPct(p.conversionRate * 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="text-center text-xs text-[#475569]">
          {formatLabel(client.slug)} · Report generated automatically by {client.agencyName}
        </div>
      </div>
    </div>
  );
}
