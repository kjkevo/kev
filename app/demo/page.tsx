"use client";

import * as React from "react";

// Public, embeddable "try it yourself" demo. A visitor types their business
// name (and what they do) and instantly sees the text-back a missed caller
// would get — and can HEAR the voice greeting spoken in their own brand via
// the browser's speech synthesis. No backend, no cost, works offline.

export default function DemoPage() {
  const [name, setName] = React.useState("");
  const [trade, setTrade] = React.useState("");
  const [shown, setShown] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const [canSpeak, setCanSpeak] = React.useState(false);

  React.useEffect(() => {
    setCanSpeak(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const biz = (name.trim() || "your business").trim();
  const serviceLine = trade.trim()
    ? ` about ${trade.trim()}`
    : "";

  const smsText =
    `Sorry we missed your call! Thanks for reaching out to ${biz}${serviceLine}. ` +
    `What can we help you with? We'll get right back to you.`;

  const voiceText =
    `Thanks for calling ${biz}! Sorry we missed you — we're helping another ` +
    `customer right now. We'll text you in just a moment so we can help.`;

  function reveal() {
    setShown(true);
  }

  function hearIt() {
    if (!canSpeak) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(voiceText);
      u.rate = 1;
      u.pitch = 1;
      const preferred = window.speechSynthesis
        .getVoices()
        .find((v) => /en(-|_)US/i.test(v.lang) && /female|Samantha|Google US/i.test(v.name));
      if (preferred) u.voice = preferred;
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      setShown(true);
      window.speechSynthesis.speak(u);
    } catch {
      setSpeaking(false);
    }
  }

  return (
    <main style={s.wrap}>
      <div style={s.grid}>
        {/* Controls */}
        <div style={s.left}>
          <div style={s.kicker}>◆ Live demo</div>
          <h1 style={s.h1}>See it work for your business</h1>
          <p style={s.sub}>
            Type your business name and we&apos;ll show you exactly what a customer gets the
            moment they call and you can&apos;t pick up — the instant text-back, and the voice
            greeting in your own brand.
          </p>

          <label style={s.label}>Your business name</label>
          <input
            style={s.input}
            value={name}
            placeholder="e.g. Apex Plumbing"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && reveal()}
          />

          <label style={s.label}>What do you do? <span style={s.opt}>(optional)</span></label>
          <input
            style={s.input}
            value={trade}
            placeholder="e.g. drain cleaning"
            onChange={(e) => setTrade(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && reveal()}
          />

          <div style={s.btnRow}>
            <button style={s.primary} onClick={reveal}>Show me the text-back</button>
            <button
              style={{ ...s.secondary, ...(speaking ? s.secondaryActive : {}) }}
              onClick={hearIt}
              disabled={!canSpeak}
              title={canSpeak ? "" : "Your browser can't play the voice preview"}
            >
              {speaking ? "🔊 Speaking…" : "🔊 Hear the voice greeting"}
            </button>
          </div>
          {!canSpeak && (
            <p style={s.tiny}>Voice preview needs a modern browser (Chrome, Safari, Edge).</p>
          )}

          <a style={s.cta} href="/start">Set this up for {biz} →</a>
        </div>

        {/* Phone mockup */}
        <div style={s.right}>
          <div style={s.phone}>
            <div style={s.notch} />
            <div style={s.screen}>
              <div style={s.smsHeader}>
                <div style={s.avatar}>{initials(biz)}</div>
                <div>
                  <div style={s.smsName}>{biz === "your business" ? "Your Business" : biz}</div>
                  <div style={s.smsStatus}>Text message · now</div>
                </div>
              </div>

              {shown ? (
                <div style={s.bubbleIn}>
                  {smsText}
                  <div style={s.footerLine}>Reply STOP to opt out, HELP for help.</div>
                </div>
              ) : (
                <div style={s.placeholder}>
                  Enter your business name and press <strong>Show me</strong> to preview the text
                  your missed callers receive.
                </div>
              )}

              <div style={s.timeStamp}>Delivered instantly · automatically</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function initials(t: string): string {
  const parts = t.replace(/[^a-zA-Z ]/g, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "★";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", background: "#070B15", color: "#E5E9F0", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "system-ui, -apple-system, sans-serif" },
  grid: { width: "100%", maxWidth: 960, display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 36, alignItems: "center" },
  left: { minWidth: 0 },
  kicker: { fontSize: 13, fontWeight: 800, color: "#34D399", letterSpacing: 0.4 },
  h1: { fontSize: 32, fontWeight: 800, margin: "8px 0 10px", lineHeight: 1.1 },
  sub: { fontSize: 15, lineHeight: 1.6, color: "#98A2B6", margin: "0 0 22px" },
  label: { display: "block", fontSize: 13, color: "#B8C0D0", margin: "12px 0 6px", fontWeight: 600 },
  opt: { color: "#6B7484", fontWeight: 400 },
  input: { width: "100%", background: "#0E1526", border: "1px solid #24324F", borderRadius: 10, padding: "12px 14px", color: "#E5E9F0", fontSize: 15 },
  btnRow: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 },
  primary: { background: "#3B82F6", color: "#fff", border: "none", borderRadius: 10, padding: "12px 18px", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  secondary: { background: "transparent", color: "#C7CEDB", border: "1px solid #2A3A5C", borderRadius: 10, padding: "12px 18px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  secondaryActive: { borderColor: "#34D399", color: "#34D399" },
  tiny: { fontSize: 12, color: "#6B7484", marginTop: 8 },
  cta: { display: "inline-block", marginTop: 26, color: "#8FB8FF", fontSize: 15, fontWeight: 700, textDecoration: "none" },
  right: { display: "flex", justifyContent: "center" },
  phone: { width: 300, background: "#0A0F1E", border: "10px solid #161C2B", borderRadius: 40, padding: "18px 14px 26px", boxShadow: "0 30px 60px rgba(0,0,0,0.45)", position: "relative" },
  notch: { width: 120, height: 22, background: "#161C2B", borderRadius: 12, margin: "0 auto 14px" },
  screen: { background: "#0E1526", borderRadius: 22, padding: 14, minHeight: 320, display: "flex", flexDirection: "column" },
  smsHeader: { display: "flex", alignItems: "center", gap: 10, paddingBottom: 12, borderBottom: "1px solid #1C2740" },
  avatar: { width: 40, height: 40, borderRadius: 20, background: "#1F3A2E", color: "#8FE3B0", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15 },
  smsName: { fontSize: 15, fontWeight: 700 },
  smsStatus: { fontSize: 12, color: "#6B7484" },
  bubbleIn: { marginTop: 16, background: "#1E2A44", color: "#EAF0FB", padding: "12px 14px", borderRadius: "16px 16px 16px 4px", fontSize: 14, lineHeight: 1.5, alignSelf: "flex-start", maxWidth: "92%" },
  footerLine: { marginTop: 8, fontSize: 11, color: "#9FB0CC" },
  placeholder: { marginTop: 20, color: "#5A6478", fontSize: 13, lineHeight: 1.6, textAlign: "center", padding: "20px 8px" },
  timeStamp: { marginTop: "auto", paddingTop: 14, fontSize: 11, color: "#4E586E", textAlign: "center" },
};
