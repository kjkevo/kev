"use client";

import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Lead = {
  id: number;
  companyName: string;
  contactName: string;
  status: string;
  dealValue: number | null;
  source: string | null;
  wonAt: string | null;
  lostAt: string | null;
  lossReason: string | null;
  assignedTo: string | null;
  createdAt: string;
  aiScore: number | null;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STAGE_PROBABILITY: Record<string, number> = {
  new: 0.05,
  contacted: 0.10,
  qualified: 0.25,
  proposal: 0.50,
  negotiation: 0.75,
  won: 1.0,
  lost: 0,
};

const LOSS_REASON_LABELS: Record<string, string> = {
  price: "Price Too High",
  timing: "Bad Timing",
  competitor: "Competitor Won",
  product_fit: "Poor Product Fit",
  no_budget: "No Budget",
  other: "Other",
};

const LOSS_REASON_COLORS: Record<string, string> = {
  price: "bg-rose-500",
  timing: "bg-amber-500",
  competitor: "bg-orange-500",
  product_fit: "bg-violet-500",
  no_budget: "bg-gray-500",
  other: "bg-blue-500",
};

const SOURCE_LABELS: Record<string, string> = {
  cold_email: "Cold Email",
  referral: "Referral",
  paid_ad: "Paid Ad",
  linkedin: "LinkedIn",
  inbound: "Inbound",
  event: "Event",
  other: "Other",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt$(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

function median(arr: number[]) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AnalyticsClient({ leads }: { leads: Lead[] }) {
  // ── Core stats ──────────────────────────────────────────────────────────
  const won = leads.filter((l) => l.status === "won");
  const lost = leads.filter((l) => l.status === "lost");
  const winRate = (won.length + lost.length) > 0
    ? Math.round((won.length / (won.length + lost.length)) * 100)
    : 0;

  // ── Revenue Forecast ────────────────────────────────────────────────────
  const withValue = leads.filter((l) => l.dealValue != null && l.dealValue > 0);
  const weightedPipeline = withValue.reduce((sum, l) => {
    const prob = STAGE_PROBABILITY[l.status] ?? 0;
    return sum + (l.dealValue! * prob);
  }, 0);
  const bestCase = withValue
    .filter((l) => l.status !== "lost")
    .reduce((sum, l) => sum + l.dealValue!, 0);
  const closedWon = won.reduce((sum, l) => sum + (l.dealValue ?? 0), 0);

  // Stage breakdown table
  const stages = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"];
  const stageRows = stages.map((stage) => {
    const stageLeads = withValue.filter((l) => l.status === stage);
    const totalVal = stageLeads.reduce((s, l) => s + l.dealValue!, 0);
    const weighted = totalVal * (STAGE_PROBABILITY[stage] ?? 0);
    return { stage, count: stageLeads.length, totalVal, weighted };
  }).filter((r) => r.count > 0);

  // ── Conversion by Source ─────────────────────────────────────────────────
  const sourceMap: Record<string, { total: number; won: number }> = {};
  for (const l of leads) {
    const src = l.source ?? "other";
    if (!sourceMap[src]) sourceMap[src] = { total: 0, won: 0 };
    sourceMap[src].total++;
    if (l.status === "won") sourceMap[src].won++;
  }
  const sourceRows = Object.entries(sourceMap)
    .map(([src, data]) => ({
      src,
      label: SOURCE_LABELS[src] ?? src,
      total: data.total,
      won: data.won,
      pct: data.total > 0 ? Math.round((data.won / data.total) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct);

  // ── Deal Cycle ───────────────────────────────────────────────────────────
  const closedWithDates = won.filter((l) => l.wonAt);
  const cycleDays = closedWithDates.map((l) => daysBetween(l.createdAt, l.wonAt!));
  const avgCycle = cycleDays.length > 0
    ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length)
    : null;
  const fastestClose = cycleDays.length > 0 ? Math.min(...cycleDays) : null;
  const slowestClose = cycleDays.length > 0 ? Math.max(...cycleDays) : null;
  const medianCycle = cycleDays.length > 0 ? Math.round(median(cycleDays)) : null;

  // ── Leaderboard ──────────────────────────────────────────────────────────
  const memberMap: Record<string, { leads: number; won: number; pipeline: number }> = {};
  for (const l of leads) {
    const name = l.assignedTo?.trim() || "Unassigned";
    if (!memberMap[name]) memberMap[name] = { leads: 0, won: 0, pipeline: 0 };
    memberMap[name].leads++;
    if (l.status === "won") memberMap[name].won++;
    if (l.dealValue) memberMap[name].pipeline += l.dealValue;
  }
  const leaderboard = Object.entries(memberMap)
    .map(([name, data]) => ({
      name,
      leads: data.leads,
      won: data.won,
      pipeline: data.pipeline,
      pct: data.leads > 0 ? Math.round((data.won / data.leads) * 100) : 0,
    }))
    .sort((a, b) => b.won - a.won);

  // ── Loss Reasons ─────────────────────────────────────────────────────────
  const lossMap: Record<string, number> = {};
  for (const l of lost) {
    const r = l.lossReason ?? "other";
    lossMap[r] = (lossMap[r] ?? 0) + 1;
  }
  const lossTotal = Object.values(lossMap).reduce((a, b) => a + b, 0);
  const lossRows = Object.entries(lossMap)
    .map(([r, count]) => ({ r, label: LOSS_REASON_LABELS[r] ?? r, count, pct: lossTotal > 0 ? Math.round((count / lossTotal) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  // ── Weekly Digest preview ────────────────────────────────────────────────
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const newThisWeek = leads.filter((l) => new Date(l.createdAt) >= weekAgo).length;
  const wonThisWeek = won.filter((l) => l.wonAt && new Date(l.wonAt) >= weekAgo).length;
  const lostThisWeek = lost.filter((l) => l.lostAt && new Date(l.lostAt) >= weekAgo).length;
  const topLead = [...leads].filter((l) => l.aiScore != null).sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0))[0] ?? null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold text-brand-700 shrink-0">LeadIQ</Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500 dark:text-gray-400">
            <Link href="/dashboard" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Dashboard</Link>
            <Link href="/kanban" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Kanban</Link>
            <Link href="/leads" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">All Leads</Link>
            <Link href="/analytics" className="text-brand-600 font-semibold">Analytics</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pipeline Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Revenue forecast, conversion analysis, and team performance</p>
        </div>

        {/* ── Top stat cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total Leads", value: leads.length.toString(), color: "text-gray-900 dark:text-white" },
            { label: "Won", value: won.length.toString(), color: "text-emerald-700 dark:text-emerald-400" },
            { label: "Lost", value: lost.length.toString(), color: "text-rose-600 dark:text-rose-400" },
            { label: "Win Rate", value: `${winRate}%`, color: winRate >= 50 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400" },
            { label: "Weighted Pipeline", value: fmt$(weightedPipeline), color: "text-brand-700 dark:text-brand-400" },
            { label: "Avg Deal Cycle", value: avgCycle != null ? `${avgCycle}d` : "—", color: "text-gray-900 dark:text-white" },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
              <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── 2-col grid: Revenue + Source ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Revenue Forecast */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-5">
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Revenue Forecast</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-brand-50 rounded-xl p-3 text-center">
                <p className="text-lg font-extrabold text-brand-700">{fmt$(weightedPipeline)}</p>
                <p className="text-xs text-brand-600 mt-0.5 font-medium">Weighted</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-lg font-extrabold text-amber-700">{fmt$(bestCase)}</p>
                <p className="text-xs text-amber-600 mt-0.5 font-medium">Best Case</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <p className="text-lg font-extrabold text-emerald-700">{fmt$(closedWon)}</p>
                <p className="text-xs text-emerald-600 mt-0.5 font-medium">Closed Won</p>
              </div>
            </div>

            {stageRows.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left pb-2 font-semibold">Stage</th>
                    <th className="text-right pb-2 font-semibold">Count</th>
                    <th className="text-right pb-2 font-semibold">Total Value</th>
                    <th className="text-right pb-2 font-semibold">Weighted</th>
                  </tr>
                </thead>
                <tbody>
                  {stageRows.map((r) => (
                    <tr key={r.stage} className="border-b border-gray-50">
                      <td className="py-2 capitalize text-gray-700 font-medium">{r.stage}</td>
                      <td className="py-2 text-right text-gray-500">{r.count}</td>
                      <td className="py-2 text-right text-gray-500">{fmt$(r.totalVal)}</td>
                      <td className="py-2 text-right font-semibold text-gray-800">{fmt$(r.weighted)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-400 italic">No deals with value set yet. Add deal values to see forecast.</p>
            )}
          </div>

          {/* Conversion by Source */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Conversion Rate by Source</h2>
            {sourceRows.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No leads yet.</p>
            ) : (
              <div className="space-y-3">
                {sourceRows.map((s) => (
                  <div key={s.src}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700">{s.label}</span>
                      <span className="text-xs text-gray-500">{s.won}/{s.total} won · <span className="font-bold text-gray-800">{s.pct}%</span></span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all"
                        style={{ width: `${s.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 2-col grid: Deal Cycle + Leaderboard ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Deal Cycle */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Average Deal Cycle</h2>
            {cycleDays.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">No closed deals yet — data will appear here once you close your first deal.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Average", value: `${avgCycle}d` },
                  { label: "Fastest Close", value: `${fastestClose}d` },
                  { label: "Slowest Close", value: `${slowestClose}d` },
                  { label: "Median", value: `${medianCycle}d` },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                    <p className="text-xl font-extrabold text-gray-900 dark:text-white">{s.value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Team Leaderboard */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Team Leaderboard</h2>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No leads yet.</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((m, i) => (
                  <div key={m.name} className={`flex items-center justify-between rounded-xl px-4 py-3 ${i === 0 ? "bg-amber-50 border border-amber-100" : "bg-gray-50"}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-400 w-5">{i + 1}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{m.name}</p>
                        <p className="text-xs text-gray-400">{m.leads} lead{m.leads !== 1 ? "s" : ""} · {fmt$(m.pipeline)} pipeline</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-600">{m.won} won</p>
                      <p className="text-xs text-gray-400">{m.pct}% conv.</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Weekly Snapshot ── */}
        <div className="bg-gradient-to-br from-brand-50 to-violet-50 rounded-2xl border border-brand-100 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Weekly Snapshot</h2>
            <a
              href="/api/analytics/digest"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-600 font-medium hover:text-brand-800"
            >
              View raw JSON →
            </a>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "New This Week", value: newThisWeek, color: "text-brand-700" },
              { label: "Deals Closed", value: wonThisWeek, color: "text-emerald-700" },
              { label: "Deals Lost", value: lostThisWeek, color: "text-rose-600" },
              { label: "Weighted Pipeline", value: fmt$(weightedPipeline), color: "text-gray-900" },
            ].map((s) => (
              <div key={s.label} className="bg-white/70 rounded-xl p-4 text-center">
                <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
          {topLead && (
            <div className="bg-white/80 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Top Lead This Week</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">{topLead.companyName}</p>
                  <p className="text-xs text-gray-500">{topLead.contactName}</p>
                </div>
                {topLead.aiScore != null && (
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                    topLead.aiScore >= 70 ? "bg-emerald-100 text-emerald-700"
                    : topLead.aiScore >= 40 ? "bg-amber-100 text-amber-700"
                    : "bg-rose-100 text-rose-700"
                  }`}>
                    AI Score: {topLead.aiScore}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Loss Reasons ── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Loss Reasons</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{lost.length} total lost</span>
              <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">
                Win Rate: {winRate}%
              </span>
            </div>
          </div>
          {lossRows.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No lost deals yet. Loss reason data will appear here.</p>
          ) : (
            <div className="space-y-3">
              {lossRows.map((r) => (
                <div key={r.r}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${LOSS_REASON_COLORS[r.r] ?? "bg-gray-400"}`} />
                      <span className="text-sm font-medium text-gray-700">{r.label}</span>
                    </div>
                    <span className="text-xs text-gray-500">{r.count} deal{r.count !== 1 ? "s" : ""} · <span className="font-bold text-gray-800">{r.pct}%</span></span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${LOSS_REASON_COLORS[r.r] ?? "bg-gray-400"}`}
                      style={{ width: `${r.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-8" />
      </main>
    </div>
  );
}
