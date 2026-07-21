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
  pipeline: Record<string, number>;
}

const REFRESH_MS = 5000;
const KEY_STORAGE = "admin_api_key";

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

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function LivePage() {
  const [businesses, setBusinesses] = React.useState<BusinessCard[]>([]);
  const [events, setEvents] = React.useState<ActivityEvent[]>([]);
  const [metrics, setMetrics] = React.useState<Metrics | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [connected, setConnected] = React.useState(false);

  // Owner mode
  const [ownerKey, setOwnerKey] = React.useState("");
  const [showKeyInput, setShowKeyInput] = React.useState(false);
  const [keyInput, setKeyInput] = React.useState("");
  const [drafts, setDrafts] = React.useState<Record<number, { dealValue: string; notes: string }>>({});
  const [savingId, setSavingId] = React.useState<number | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(KEY_STORAGE) : null;
    if (saved) setOwnerKey(saved);
  }, []);

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

  const ownerMode = ownerKey.length > 0;

  function saveKey(e: React.FormEvent) {
    e.preventDefault();
    const k = keyInput.trim();
    if (!k) return;
    window.localStorage.setItem(KEY_STORAGE, k);
    setOwnerKey(k);
    setShowKeyInput(false);
    setKeyInput("");
  }

  function exitOwner() {
    window.localStorage.removeItem(KEY_STORAGE);
    setOwnerKey("");
  }

  async function patchCall(dbId: number, payload: Record<string, unknown>) {
    setSavingId(dbId);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/missed-calls/${dbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-key": ownerKey },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(j.error || `Save failed (${res.status})`);
        return;
      }
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
    setDrafts((d) => ({ ...d, [dbId]: { ...draftForId(dbId), ...patch } }));
  }
  function draftForId(dbId: number) {
    return drafts[dbId] ?? { dealValue: "", notes: "" };
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <div>
            <h1 style={s.h1}>Missed-Call Text-Back — Live</h1>
            <p style={s.sub}>Real-time view of businesses on file and the calls flowing through the system.</p>
          </div>
          <div style={s.headerRight}>
            <div style={s.liveWrap}>
              <span style={{ ...s.dot, background: connected ? "#34D399" : "#6B7280" }} />
              <span style={s.liveText}>{connected ? "LIVE" : "connecting…"}</span>
            </div>
            {ownerMode ? (
              <button style={s.ownerBtnActive} onClick={exitOwner}>Owner mode ✓</button>
            ) : (
              <button style={s.ownerBtn} onClick={() => setShowKeyInput((v) => !v)}>Owner mode</button>
            )}
          </div>
        </header>

        {showKeyInput && !ownerMode && (
          <form onSubmit={saveKey} style={s.keyForm}>
            <input type="password" value={keyInput} placeholder="Admin key"
              onChange={(e) => setKeyInput(e.target.value)} style={s.keyInput} autoFocus />
            <button type="submit" style={s.smallPrimary}>Unlock editing</button>
          </form>
        )}

        {/* Metrics */}
        {metrics && (
          <section style={s.metricsRow}>
            <Stat label="Missed calls (mo.)" value={String(metrics.missedThisMonth)} sub={`${metrics.totalMissed} all-time`} />
            <Stat label="Recovery rate" value={`${metrics.recoveryRate}%`} sub="got a reply" accent="#8FE3B0" />
            <Stat label="Booked / Won" value={String(metrics.bookedWon)} sub={`${metrics.won} won`} accent="#C9B8F0" />
            <Stat label="Recovered rev. (mo.)" value={money(metrics.recoveredRevenueMonth)} sub={`${money(metrics.recoveredRevenueTotal)} total`} accent="#8FE3B0" />
          </section>
        )}

        {/* Pipeline summary */}
        {metrics && (
          <section style={s.pipelineRow}>
            {STATUSES.map((st) => (
              <span key={st} style={s.pipeItem}>
                <span style={{ ...s.pipeDot, background: STATUS_META[st].fg }} />
                {STATUS_META[st].label}
                <b style={s.pipeCount}>{metrics.pipeline[st] ?? 0}</b>
              </span>
            ))}
          </section>
        )}

        {/* Businesses */}
        <section>
          <h2 style={s.h2}>Businesses on file ({businesses.length})</h2>
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
            {businesses.length === 0 && <div style={s.empty}>No businesses yet.</div>}
          </div>
        </section>

        {/* Activity feed */}
        <section>
          <h2 style={s.h2}>Live activity</h2>
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

                  {/* Owner controls */}
                  {ownerMode && e.dbId != null && (
                    <div style={s.controls}>
                      <select
                        value={e.pipeline ?? "new"}
                        onChange={(ev) => patchCall(e.dbId!, { status: ev.target.value })}
                        style={s.select}
                        disabled={savingId === e.dbId}
                      >
                        {STATUSES.map((st) => (
                          <option key={st} value={st}>{STATUS_META[st].label}</option>
                        ))}
                      </select>
                      <div style={s.moneyWrap}>
                        <span style={s.dollar}>$</span>
                        <input
                          type="number" min="0" placeholder="deal value"
                          value={d.dealValue}
                          onChange={(ev) => setDraft(e.dbId!, { dealValue: ev.target.value })}
                          style={s.moneyInput}
                        />
                      </div>
                      <input
                        placeholder="note"
                        value={d.notes}
                        onChange={(ev) => setDraft(e.dbId!, { notes: ev.target.value })}
                        style={s.noteInput}
                      />
                      <button
                        style={s.saveBtn}
                        disabled={savingId === e.dbId}
                        onClick={() => patchCall(e.dbId!, {
                          dealValue: d.dealValue === "" ? null : d.dealValue,
                          notes: d.notes,
                        })}
                      >
                        {savingId === e.dbId ? "…" : "Save"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <footer style={s.footer}>
          Auto-refreshes every {REFRESH_MS / 1000}s
          {lastUpdated && ` · updated ${lastUpdated.toLocaleTimeString()}`}
          {" · customer numbers are partially masked for privacy"}
        </footer>
      </div>
    </div>
  );
}

/* ─── Small components ───────────────────────────────────────────────────── */

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={s.stat}>
      <div style={s.statLabel}>{label}</div>
      <div style={{ ...s.statValue, color: accent ?? "#E5E9F0" }}>{value}</div>
      {sub && <div style={s.statSub}>{sub}</div>}
    </div>
  );
}

function money(n: number): string {
  return `$${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

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
  page: { minHeight: "100vh", background: "#080D1A", color: "#E5E9F0", padding: "32px 16px", fontFamily: "system-ui, -apple-system, sans-serif" },
  container: { maxWidth: 940, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  h1: { fontSize: 26, fontWeight: 700, margin: 0 },
  sub: { color: "#8A93A6", fontSize: 14, margin: "6px 0 0" },
  liveWrap: { display: "flex", alignItems: "center", gap: 8, background: "#0E1526", border: "1px solid #1E2A44", borderRadius: 999, padding: "6px 14px" },
  dot: { width: 10, height: 10, borderRadius: 999, display: "inline-block" },
  liveText: { fontSize: 13, fontWeight: 700, letterSpacing: 0.5 },
  ownerBtn: { background: "transparent", color: "#9FC2FF", border: "1px solid #24324F", borderRadius: 999, padding: "6px 14px", fontSize: 13, cursor: "pointer" },
  ownerBtnActive: { background: "#12301F", color: "#8FE3B0", border: "1px solid #1E4A32", borderRadius: 999, padding: "6px 14px", fontSize: 13, cursor: "pointer" },
  keyForm: { display: "flex", gap: 8, alignItems: "center" },
  keyInput: { background: "#0A0F1E", border: "1px solid #24324F", borderRadius: 8, padding: "8px 12px", color: "#E5E9F0", fontSize: 14, flex: 1, maxWidth: 260 },
  smallPrimary: { background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" },

  metricsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 },
  stat: { background: "#0E1526", border: "1px solid #1E2A44", borderRadius: 12, padding: "14px 16px" },
  statLabel: { fontSize: 12, color: "#8A93A6", textTransform: "uppercase", letterSpacing: 0.4 },
  statValue: { fontSize: 26, fontWeight: 700, marginTop: 4 },
  statSub: { fontSize: 12, color: "#6B7484", marginTop: 2 },

  pipelineRow: { display: "flex", flexWrap: "wrap", gap: 14, background: "#0B111F", border: "1px solid #17223A", borderRadius: 10, padding: "10px 14px" },
  pipeItem: { display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#AAB2C2" },
  pipeDot: { width: 8, height: 8, borderRadius: 999, display: "inline-block" },
  pipeCount: { color: "#E5E9F0" },

  h2: { fontSize: 16, fontWeight: 600, margin: "0 0 12px", color: "#C7CEDB" },
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
  saveError: { background: "#3A1620", color: "#F7A8B8", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 8 },

  empty: { color: "#6B7484", fontSize: 14, padding: "12px 0" },
  footer: { color: "#5A6373", fontSize: 12, textAlign: "center", paddingTop: 8 },
};
