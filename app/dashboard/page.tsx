"use client";

import * as React from "react";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface BusinessCard {
  id: number;
  name: string;
  phone: string;
  smsEnabled: boolean;
  voiceEnabled: boolean;
  missedCallMessage: string;
  voiceGreeting: string | null;
  missedCallCount: number;
}

interface ActivityEvent {
  id: string;
  dbId: number | null;
  kind: "missed_call" | "lead";
  business: string;
  caller: string;
  delivery: string;
  pipeline: string | null;
  dealValue: number | null;
  notes: string | null;
  outbound: string;
  reply: string | null;
  at: string;
}

interface Metrics {
  totalMissed: number;
  missedThisMonth: number;
  recoveryRate: number;
  bookedWon: number;
  won: number;
  recoveredRevenueTotal: number;
  recoveredRevenueMonth: number;
  avgResponseSec: number | null;
  conversionRate: number;
  pipeline: Record<string, number>;
}

const REFRESH_MS = 5000;
const STATUSES = ["new", "contacted", "booked", "won", "lost", "no_response", "spam"] as const;
const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  new: { label: "New", bg: "#1B2740", fg: "#9FC2FF" },
  contacted: { label: "Contacted", bg: "#20304F", fg: "#BBD3FF" },
  booked: { label: "Booked", bg: "#2A2333", fg: "#C9B8F0" },
  won: { label: "Won", bg: "#12301F", fg: "#8FE3B0" },
  lost: { label: "Lost", bg: "#3A1620", fg: "#F7A8B8" },
  no_response: { label: "No response", bg: "#26262E", fg: "#9AA2B0" },
  spam: { label: "Spam", bg: "#2A2020", fg: "#D69A9A" },
};

type Tab = "clients" | "metrics" | "activity" | "support";

interface SupportTicket {
  id: number;
  createdAt: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: string;
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const [tab, setTab] = React.useState<Tab>("metrics");
  const [businesses, setBusinesses] = React.useState<BusinessCard[]>([]);
  const [events, setEvents] = React.useState<ActivityEvent[]>([]);
  const [metrics, setMetrics] = React.useState<Metrics | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [connected, setConnected] = React.useState(false);

  const [drafts, setDrafts] = React.useState<Record<number, { dealValue: string; notes: string }>>({});
  const [savingId, setSavingId] = React.useState<number | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const [tickets, setTickets] = React.useState<SupportTicket[]>([]);

  // Access is gated by the owner login (middleware), so the dashboard is always
  // in owner mode and admin calls rely on the session cookie (sent automatically).
  const ownerMode = true;

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/public/activity", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setBusinesses(data.businesses ?? []);
      setEvents(data.events ?? []);
      setMetrics(data.metrics ?? null);
      setLastUpdated(new Date());
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const loadTickets = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/support", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setTickets(data.tickets ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    if (tab === "support") loadTickets();
  }, [tab, loadTickets]);

  async function resolveTicket(id: number, status: "open" | "resolved") {
    try {
      const res = await fetch(`/api/admin/support/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) loadTickets();
    } catch {
      /* ignore */
    }
  }

  async function signOut() {
    try {
      await fetch("/api/auth/owner-logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    window.location.href = "/login";
  }

  async function patchCall(dbId: number, payload: Record<string, unknown>) {
    setSavingId(dbId);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/missed-calls/${dbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveError(j.error || `Save failed (${res.status})`); return; }
      await load();
    } catch (err) {
      setSaveError(String(err));
    } finally {
      setSavingId(null);
    }
  }

  function draftFor(e: ActivityEvent) {
    const existing = e.dbId != null ? drafts[e.dbId] : undefined;
    return existing ?? { dealValue: e.dealValue != null ? String(e.dealValue) : "", notes: e.notes ?? "" };
  }
  function setDraft(dbId: number, patch: Partial<{ dealValue: string; notes: string }>) {
    setDrafts((d) => ({ ...d, [dbId]: { ...(d[dbId] ?? { dealValue: "", notes: "" }), ...patch } }));
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        {/* Top bar */}
        <header style={s.header}>
          <div style={s.brand}>
            <span style={s.logo}>◆</span>
            <div>
              <div style={s.brandName}>Recover</div>
              <div style={s.brandSub}>Missed-call recovery command center</div>
            </div>
          </div>
          <div style={s.headerRight}>
            <div style={s.liveWrap}>
              <span style={{ ...s.dot, background: connected ? "#34D399" : "#6B7280" }} />
              <span style={s.liveText}>{connected ? "LIVE" : "connecting…"}</span>
            </div>
            <button style={s.ownerBtn} onClick={signOut}>Sign out</button>
          </div>
        </header>

        {/* Tabs */}
        <nav style={s.tabs}>
          <TabButton active={tab === "metrics"} onClick={() => setTab("metrics")} label="Metrics" />
          <TabButton active={tab === "clients"} onClick={() => setTab("clients")} label={`Clients${businesses.length ? ` (${businesses.length})` : ""}`} />
          <TabButton active={tab === "activity"} onClick={() => setTab("activity")} label="Activity" />
          <TabButton active={tab === "support"} onClick={() => setTab("support")} label="Support" />
        </nav>

        {tab === "metrics" && <MetricsTab metrics={metrics} />}
        {tab === "clients" && <ClientsTab businesses={businesses} />}
        {tab === "activity" && (
          <ActivityTab
            events={events} ownerMode={ownerMode} saveError={saveError}
            savingId={savingId} patchCall={patchCall} draftFor={draftFor} setDraft={setDraft}
          />
        )}
        {tab === "support" && (
          <SupportTab tickets={tickets} resolveTicket={resolveTicket} />
        )}

        <footer style={s.footer}>
          Auto-refreshes every {REFRESH_MS / 1000}s
          {lastUpdated && ` · updated ${lastUpdated.toLocaleTimeString()}`}
          {" · manage clients at "}<a href="/admin" style={s.footLink}>/admin</a>
        </footer>
      </div>
    </div>
  );
}

/* ─── Tabs ───────────────────────────────────────────────────────────────── */

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{ ...s.tab, ...(active ? s.tabActive : {}) }}>{label}</button>
  );
}

function MetricsTab({ metrics }: { metrics: Metrics | null }) {
  if (!metrics) return <div style={s.empty}>Loading metrics…</div>;
  const resp = metrics.avgResponseSec;
  const respLabel = resp == null ? "—" : resp < 1 ? "<1s" : `${resp}s`;
  return (
    <div style={s.tabBody}>
      <div style={s.roiCaption}>Your ROI proof — the numbers that justify the subscription</div>
      <div style={s.metricsRow}>
        <Stat big label="Recovery rate" value={`${metrics.recoveryRate}%`} sub="of missed calls got a reply" accent="#8FE3B0" />
        <Stat big label="Avg first response" value={respLabel} sub="automation (manual: soon)" accent="#9FC2FF" />
        <Stat big label="Booking / reply rate" value={`${metrics.conversionRate}%`} sub="of replies converted" accent="#C9B8F0" />
        <Stat big label="Recovered revenue" value={money(metrics.recoveredRevenueMonth)} sub={`${money(metrics.recoveredRevenueTotal)} all-time`} accent="#8FE3B0" />
      </div>

      <div style={s.subGrid}>
        <div style={s.panel}>
          <div style={s.panelTitle}>Volume</div>
          <Row k="Missed calls this month" v={String(metrics.missedThisMonth)} />
          <Row k="Missed calls all-time" v={String(metrics.totalMissed)} />
          <Row k="Booked / Won" v={String(metrics.bookedWon)} />
          <Row k="Won" v={String(metrics.won)} />
        </div>
        <div style={s.panel}>
          <div style={s.panelTitle}>Pipeline</div>
          {STATUSES.map((st) => (
            <Row key={st} k={STATUS_META[st].label} v={String(metrics.pipeline[st] ?? 0)} dot={STATUS_META[st].fg} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ClientsTab({ businesses }: { businesses: BusinessCard[] }) {
  return (
    <div style={s.tabBody}>
      <div style={s.clientsHead}>
        <div style={s.roiCaption}>Businesses you&apos;re working with</div>
        <a href="/admin" style={s.addBtn}>+ Add / edit clients</a>
      </div>
      {businesses.length === 0 && <div style={s.empty}>No clients yet. Add one at /admin.</div>}
      <div style={s.bizGrid}>
        {businesses.map((b) => (
          <div key={b.id} style={s.bizCard}>
            <div style={s.bizName}>{b.name}</div>
            <div style={s.bizPhone}>{b.phone}</div>
            <div style={s.chips}>
              <span style={{ ...s.chip, ...(b.smsEnabled ? s.chipOn : s.chipOff) }}>Text {b.smsEnabled ? "on" : "off"}</span>
              <span style={{ ...s.chip, ...(b.voiceEnabled ? s.chipOn : s.chipOff) }}>Voice {b.voiceEnabled ? "on" : "off"}</span>
            </div>
            <div style={s.bizMsg}>“{b.missedCallMessage}”</div>
            <div style={s.bizCount}>{b.missedCallCount} missed call{b.missedCallCount === 1 ? "" : "s"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityTab({
  events, ownerMode, saveError, savingId, patchCall, draftFor, setDraft,
}: {
  events: ActivityEvent[]; ownerMode: boolean; saveError: string | null; savingId: number | null;
  patchCall: (id: number, p: Record<string, unknown>) => void;
  draftFor: (e: ActivityEvent) => { dealValue: string; notes: string };
  setDraft: (id: number, p: Partial<{ dealValue: string; notes: string }>) => void;
}) {
  return (
    <div style={s.tabBody}>
      {saveError && <div style={s.saveError}>{saveError}</div>}
      <div style={s.feed}>
        {events.length === 0 && <div style={s.empty}>Waiting for the first call…</div>}
        {events.map((e) => {
          const meta = e.pipeline ? STATUS_META[e.pipeline] ?? STATUS_META.new : null;
          const d = draftFor(e);
          return (
            <div key={e.id} style={s.event}>
              <div style={s.eventTop}>
                <span style={s.eventKind}>{e.kind === "missed_call" ? "📞 Missed call" : "📝 Lead"}</span>
                <span style={s.eventBiz}>{e.business}</span>
                {meta && <span style={{ ...s.pill, background: meta.bg, color: meta.fg }}>{meta.label}</span>}
                {e.dealValue != null && <span style={s.revPill}>{money(e.dealValue)}</span>}
                <span style={s.eventTime}>{timeAgo(e.at)}</span>
              </div>
              <div style={s.eventRow}>
                <span style={s.eventCaller}>{e.caller}</span>
                <span style={s.deliveryTag}>text {e.delivery}</span>
              </div>
              <div style={s.bubbleOut}>{e.outbound}</div>
              {e.reply && <div style={s.bubbleIn}>{e.reply}</div>}
              {e.notes && !ownerMode && <div style={s.noteView}>📝 {e.notes}</div>}
              {ownerMode && e.dbId != null && (
                <div style={s.controls}>
                  <select value={e.pipeline ?? "new"} disabled={savingId === e.dbId}
                    onChange={(ev) => patchCall(e.dbId!, { status: ev.target.value })} style={s.select}>
                    {STATUSES.map((st) => <option key={st} value={st}>{STATUS_META[st].label}</option>)}
                  </select>
                  <div style={s.moneyWrap}>
                    <span style={s.dollar}>$</span>
                    <input type="number" min="0" placeholder="deal value" value={d.dealValue}
                      onChange={(ev) => setDraft(e.dbId!, { dealValue: ev.target.value })} style={s.moneyInput} />
                  </div>
                  <input placeholder="note" value={d.notes}
                    onChange={(ev) => setDraft(e.dbId!, { notes: ev.target.value })} style={s.noteInput} />
                  <button style={s.saveBtn} disabled={savingId === e.dbId}
                    onClick={() => patchCall(e.dbId!, { dealValue: d.dealValue === "" ? null : d.dealValue, notes: d.notes })}>
                    {savingId === e.dbId ? "…" : "Save"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SupportTab({
  tickets, resolveTicket,
}: {
  tickets: SupportTicket[];
  resolveTicket: (id: number, status: "open" | "resolved") => void;
}) {
  const open = tickets.filter((t) => t.status !== "resolved");
  const resolved = tickets.filter((t) => t.status === "resolved");
  return (
    <div style={s.tabBody}>
      <div style={s.clientsHead}>
        <div style={s.roiCaption}>{open.length} open · {resolved.length} resolved</div>
        <a href="/support" target="_blank" rel="noopener noreferrer" style={s.addBtn}>View public form ↗</a>
      </div>
      {tickets.length === 0 && <div style={s.empty}>No tickets yet.</div>}
      <div style={s.feed}>
        {[...open, ...resolved].map((t) => (
          <div key={t.id} style={s.event}>
            <div style={s.eventTop}>
              <span style={s.eventKind}>✉️ {t.subject || "(no subject)"}</span>
              <span style={{ ...s.pill, ...(t.status === "resolved" ? { background: "#12301F", color: "#8FE3B0" } : { background: "#2A2333", color: "#C9B8F0" }) }}>
                {t.status}
              </span>
              <span style={s.eventTime}>{timeAgo(t.createdAt)}</span>
            </div>
            <div style={s.eventRow}>
              <span style={s.eventCaller}>{t.name}</span>
              <a href={`mailto:${t.email}`} style={s.footLink}>{t.email}</a>
            </div>
            <div style={s.bubbleOut}>{t.message}</div>
            <div style={s.controls}>
              {t.status === "resolved" ? (
                <button style={s.smallBtn} onClick={() => resolveTicket(t.id, "open")}>Reopen</button>
              ) : (
                <button style={s.saveBtn} onClick={() => resolveTicket(t.id, "resolved")}>Mark resolved</button>
              )}
              <a href={`mailto:${t.email}?subject=Re: ${encodeURIComponent(t.subject || "your message")}`} style={s.smallBtn}>Reply by email</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Small components ───────────────────────────────────────────────────── */

function Stat({ label, value, sub, accent, big }: { label: string; value: string; sub?: string; accent?: string; big?: boolean }) {
  return (
    <div style={s.stat}>
      <div style={s.statLabel}>{label}</div>
      <div style={{ ...(big ? s.statValueBig : s.statValue), color: accent ?? "#E5E9F0" }}>{value}</div>
      {sub && <div style={s.statSub}>{sub}</div>}
    </div>
  );
}
function Row({ k, v, dot }: { k: string; v: string; dot?: string }) {
  return (
    <div style={s.kv}>
      <span style={s.kvK}>{dot && <span style={{ ...s.pipeDot, background: dot }} />}{k}</span>
      <span style={s.kvV}>{v}</span>
    </div>
  );
}
function money(n: number): string { return `$${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`; }
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#070B15", color: "#E5E9F0", padding: "28px 16px", fontFamily: "system-ui, -apple-system, sans-serif" },
  container: { maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" },
  brand: { display: "flex", alignItems: "center", gap: 12 },
  logo: { fontSize: 22, color: "#34D399" },
  brandName: { fontSize: 20, fontWeight: 800, letterSpacing: -0.3 },
  brandSub: { fontSize: 12.5, color: "#7A828F" },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  liveWrap: { display: "flex", alignItems: "center", gap: 8, background: "#0E1526", border: "1px solid #1E2A44", borderRadius: 999, padding: "6px 14px" },
  dot: { width: 10, height: 10, borderRadius: 999, display: "inline-block" },
  liveText: { fontSize: 13, fontWeight: 700, letterSpacing: 0.5 },
  ownerBtn: { background: "transparent", color: "#9FC2FF", border: "1px solid #24324F", borderRadius: 999, padding: "6px 14px", fontSize: 13, cursor: "pointer" },
  ownerBtnActive: { background: "#12301F", color: "#8FE3B0", border: "1px solid #1E4A32", borderRadius: 999, padding: "6px 14px", fontSize: 13, cursor: "pointer" },
  keyForm: { display: "flex", gap: 8, alignItems: "center" },
  keyInput: { background: "#0A0F1E", border: "1px solid #24324F", borderRadius: 8, padding: "8px 12px", color: "#E5E9F0", fontSize: 14, flex: 1, maxWidth: 260 },
  smallPrimary: { background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" },

  tabs: { display: "flex", gap: 6, borderBottom: "1px solid #17223A" },
  tab: { background: "transparent", color: "#8A93A6", border: "none", borderBottom: "2px solid transparent", padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  tabActive: { color: "#FFFFFF", borderBottom: "2px solid #34D399" },
  tabBody: { display: "flex", flexDirection: "column", gap: 16 },

  roiCaption: { fontSize: 13, color: "#8A93A6" },
  metricsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 },
  stat: { background: "linear-gradient(180deg,#0F1728,#0C1220)", border: "1px solid #1E2A44", borderRadius: 14, padding: "18px 18px" },
  statLabel: { fontSize: 12, color: "#8A93A6", textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: 24, fontWeight: 700, marginTop: 6 },
  statValueBig: { fontSize: 34, fontWeight: 800, marginTop: 6, letterSpacing: -0.5 },
  statSub: { fontSize: 12, color: "#6B7484", marginTop: 4 },

  subGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 },
  panel: { background: "#0C1220", border: "1px solid #17223A", borderRadius: 14, padding: 16 },
  panelTitle: { fontSize: 13, fontWeight: 700, color: "#C7CEDB", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  kv: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderTop: "1px solid #121B2E" },
  kvK: { fontSize: 13.5, color: "#AAB2C2", display: "flex", alignItems: "center", gap: 8 },
  kvV: { fontSize: 14, fontWeight: 700 },
  pipeDot: { width: 8, height: 8, borderRadius: 999, display: "inline-block" },

  clientsHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  addBtn: { background: "#3B82F6", color: "#fff", textDecoration: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600 },
  bizGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 },
  bizCard: { background: "#0E1526", border: "1px solid #1E2A44", borderRadius: 12, padding: 16 },
  bizName: { fontSize: 16, fontWeight: 700 },
  bizPhone: { fontSize: 13, color: "#8A93A6", marginTop: 2 },
  chips: { display: "flex", gap: 6, margin: "10px 0" },
  chip: { fontSize: 11, fontWeight: 600, borderRadius: 999, padding: "3px 8px" },
  chipOn: { background: "#12301F", color: "#8FE3B0" },
  chipOff: { background: "#22262E", color: "#7A828F" },
  bizMsg: { fontSize: 12.5, color: "#AAB2C2", fontStyle: "italic", lineHeight: 1.4 },
  bizCount: { fontSize: 12, color: "#6B7484", marginTop: 10 },

  feed: { display: "flex", flexDirection: "column", gap: 10 },
  event: { background: "#0E1526", border: "1px solid #1E2A44", borderRadius: 12, padding: 14 },
  eventTop: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  eventKind: { fontSize: 13, fontWeight: 700 },
  eventBiz: { fontSize: 13, color: "#8FB8FF" },
  pill: { fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 9px" },
  revPill: { fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 9px", background: "#12301F", color: "#8FE3B0" },
  eventTime: { fontSize: 12, color: "#6B7484", marginLeft: "auto" },
  eventRow: { display: "flex", alignItems: "center", gap: 10, margin: "8px 0" },
  eventCaller: { fontSize: 14, fontFamily: "ui-monospace, monospace", color: "#D6DCE8" },
  deliveryTag: { fontSize: 11, color: "#7A828F", textTransform: "uppercase", letterSpacing: 0.4 },
  bubbleOut: { background: "#14233F", color: "#DCE6FA", borderRadius: "12px 12px 12px 4px", padding: "8px 12px", fontSize: 13.5, maxWidth: "85%", lineHeight: 1.4 },
  bubbleIn: { background: "#22262E", color: "#E5E9F0", borderRadius: "12px 12px 4px 12px", padding: "8px 12px", fontSize: 13.5, maxWidth: "85%", marginLeft: "auto", marginTop: 6, lineHeight: 1.4 },
  noteView: { fontSize: 12.5, color: "#AAB2C2", marginTop: 8, fontStyle: "italic" },
  controls: { display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center", borderTop: "1px solid #17223A", paddingTop: 10 },
  select: { background: "#0A0F1E", border: "1px solid #24324F", borderRadius: 8, padding: "7px 10px", color: "#E5E9F0", fontSize: 13 },
  moneyWrap: { display: "flex", alignItems: "center", background: "#0A0F1E", border: "1px solid #24324F", borderRadius: 8, padding: "0 8px" },
  dollar: { color: "#6B7484", fontSize: 13 },
  moneyInput: { background: "transparent", border: "none", padding: "7px 4px", color: "#E5E9F0", fontSize: 13, width: 90, outline: "none" },
  noteInput: { background: "#0A0F1E", border: "1px solid #24324F", borderRadius: 8, padding: "7px 10px", color: "#E5E9F0", fontSize: 13, flex: 1, minWidth: 120 },
  saveBtn: { background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  smallBtn: { background: "#1B2740", color: "#E5E9F0", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none" },
  saveError: { background: "#3A1620", color: "#F7A8B8", padding: "8px 12px", borderRadius: 8, fontSize: 13 },

  empty: { color: "#6B7484", fontSize: 14, padding: "16px 0" },
  footer: { color: "#5A6373", fontSize: 12, textAlign: "center", paddingTop: 12 },
  footLink: { color: "#8FB8FF", textDecoration: "none" },
};
