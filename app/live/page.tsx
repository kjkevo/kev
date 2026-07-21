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
  kind: "missed_call" | "lead";
  business: string;
  caller: string;
  status: string;
  outbound: string;
  reply: string | null;
  at: string;
}

const REFRESH_MS = 5000;

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function LivePage() {
  const [businesses, setBusinesses] = React.useState<BusinessCard[]>([]);
  const [events, setEvents] = React.useState<ActivityEvent[]>([]);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/public/activity", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (!active) return;
        setBusinesses(data.businesses ?? []);
        setEvents(data.events ?? []);
        setLastUpdated(new Date());
        setConnected(true);
      } catch {
        if (active) setConnected(false);
      }
    }

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <div>
            <h1 style={s.h1}>Missed-Call Text-Back — Live</h1>
            <p style={s.sub}>Real-time view of businesses on file and the calls flowing through the system.</p>
          </div>
          <div style={s.liveWrap}>
            <span style={{ ...s.dot, background: connected ? "#34D399" : "#6B7280" }} />
            <span style={s.liveText}>{connected ? "LIVE" : "connecting…"}</span>
          </div>
        </header>

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
          <div style={s.feed}>
            {events.length === 0 && <div style={s.empty}>Waiting for the first call…</div>}
            {events.map((e) => (
              <div key={e.id} style={s.event}>
                <div style={s.eventTop}>
                  <span style={s.eventKind}>{e.kind === "missed_call" ? "📞 Missed call" : "📝 Lead"}</span>
                  <span style={s.eventBiz}>{e.business}</span>
                  <span style={s.eventTime}>{timeAgo(e.at)}</span>
                </div>
                <div style={s.eventRow}>
                  <span style={s.eventCaller}>{e.caller}</span>
                  <StatusBadge status={e.status} />
                </div>
                <div style={s.bubbleOut}>{e.outbound}</div>
                {e.reply && <div style={s.bubbleIn}>{e.reply}</div>}
              </div>
            ))}
          </div>
        </section>

        <footer style={s.footer}>
          Auto-refreshes every {REFRESH_MS / 1000}s
          {lastUpdated && ` · last updated ${lastUpdated.toLocaleTimeString()}`}
          {" · customer numbers are partially masked for privacy"}
        </footer>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, React.CSSProperties> = {
    sent: { background: "#12301F", color: "#8FE3B0" },
    failed: { background: "#3A1620", color: "#F7A8B8" },
    skipped: { background: "#2A2A33", color: "#B8C0D0" },
    pending: { background: "#2A2333", color: "#C9B8F0" },
  };
  return <span style={{ ...s.badge, ...(map[status] ?? map.pending) }}>{status}</span>;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#080D1A", color: "#E5E9F0", padding: "32px 16px", fontFamily: "system-ui, -apple-system, sans-serif" },
  container: { maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" },
  h1: { fontSize: 26, fontWeight: 700, margin: 0 },
  sub: { color: "#8A93A6", fontSize: 14, margin: "6px 0 0" },
  liveWrap: { display: "flex", alignItems: "center", gap: 8, background: "#0E1526", border: "1px solid #1E2A44", borderRadius: 999, padding: "6px 14px" },
  dot: { width: 10, height: 10, borderRadius: 999, display: "inline-block" },
  liveText: { fontSize: 13, fontWeight: 700, letterSpacing: 0.5 },
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
  eventTime: { fontSize: 12, color: "#6B7484", marginLeft: "auto" },
  eventRow: { display: "flex", alignItems: "center", gap: 10, margin: "8px 0" },
  eventCaller: { fontSize: 14, fontFamily: "ui-monospace, monospace", color: "#D6DCE8" },
  badge: { fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 8px", textTransform: "uppercase" },
  bubbleOut: { background: "#14233F", color: "#DCE6FA", borderRadius: "12px 12px 12px 4px", padding: "8px 12px", fontSize: 13.5, maxWidth: "85%", lineHeight: 1.4 },
  bubbleIn: { background: "#22262E", color: "#E5E9F0", borderRadius: "12px 12px 4px 12px", padding: "8px 12px", fontSize: 13.5, maxWidth: "85%", marginLeft: "auto", marginTop: 6, lineHeight: 1.4 },
  empty: { color: "#6B7484", fontSize: 14, padding: "12px 0" },
  footer: { color: "#5A6373", fontSize: 12, textAlign: "center", paddingTop: 8 },
};
