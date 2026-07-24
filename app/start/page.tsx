"use client";

import * as React from "react";

// Public onboarding: prospect enters their details -> we capture the lead and
// show them exactly what happens next, including the call-forwarding steps.

export default function StartPage() {
  const [form, setForm] = React.useState({ businessName: "", mobile: "", email: "", trade: "" });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const biz = form.businessName.trim() || "your business";

  if (done) {
    return (
      <main style={s.wrap}>
        <div style={s.card}>
          <div style={s.kicker}>◆ You&apos;re in</div>
          <h1 style={s.h1}>Nice — {biz} is on the list! 🎉</h1>
          <p style={s.sub}>
            We&apos;ll set up your dedicated number and custom text-back, then reach out at{" "}
            <strong>{form.email || "your email"}</strong> to confirm. Here&apos;s what happens next,
            and the one 2-minute thing we&apos;ll need from you.
          </p>

          <ol style={s.steps}>
            <li style={s.step}>
              <strong>We provision your number.</strong> You get a dedicated line that answers and
              texts back for {biz} — your real number never changes.
            </li>
            <li style={s.step}>
              <strong>You turn on call forwarding</strong> so unanswered calls roll to us (the
              2-minute step below).
            </li>
            <li style={s.step}>
              <strong>You go live.</strong> Every missed call gets an instant text-back, and it all
              shows up on your dashboard.
            </li>
          </ol>

          <div style={s.fwdBox}>
            <div style={s.fwdTitle}>The 2-minute step: turn on call forwarding</div>
            <p style={s.fwdIntro}>
              Once we send you your number, dial these on the business phone (codes vary slightly by
              carrier — we&apos;ll confirm yours):
            </p>
            <ul style={s.fwdList}>
              <li><strong>Forward when unanswered:</strong> dial <code style={s.code}>*71</code> then your new number</li>
              <li><strong>Forward when busy:</strong> dial <code style={s.code}>*90</code> then your new number</li>
              <li><strong>Forward when unreachable:</strong> dial <code style={s.code}>*92</code> then your new number</li>
            </ul>
            <p style={s.fwdNote}>
              On a VoIP/office phone system it&apos;s a settings toggle instead of a dial code — we&apos;ll
              walk you through it.
            </p>
          </div>

          <a style={s.cta} href="/demo">See your text-back again in the live demo →</a>
        </div>
      </main>
    );
  }

  return (
    <main style={s.wrap}>
      <form style={s.card} onSubmit={submit}>
        <div style={s.kicker}>◆ Start your free trial</div>
        <h1 style={s.h1}>Stop losing missed calls</h1>
        <p style={s.sub}>
          No credit card. We build your custom text-back, connect your number, and get you live —
          so every missed call turns into a text conversation instead of a lost customer.
        </p>

        <label style={s.label}>Business name</label>
        <input style={s.input} value={form.businessName} placeholder="e.g. Apex Plumbing"
          onChange={(e) => set("businessName", e.target.value)} required />

        <label style={s.label}>Your mobile number</label>
        <input style={s.input} value={form.mobile} placeholder="(555) 123-4567" inputMode="tel"
          onChange={(e) => set("mobile", e.target.value)} required />

        <label style={s.label}>Email address</label>
        <input style={s.input} type="email" value={form.email} placeholder="you@example.com"
          onChange={(e) => set("email", e.target.value)} required />

        <label style={s.label}>What do you do? <span style={s.opt}>(optional)</span></label>
        <input style={s.input} value={form.trade} placeholder="e.g. plumbing & drain cleaning"
          onChange={(e) => set("trade", e.target.value)} />

        {error && <div style={s.error}>{error}</div>}

        <button type="submit" style={s.submit} disabled={submitting}>
          {submitting ? "Submitting…" : "Activate my free trial"}
        </button>
        <p style={s.fine}>
          By submitting, you agree to be contacted about setting up your account. See our{" "}
          <a style={s.link} href="/privacy">Privacy Policy</a> and{" "}
          <a style={s.link} href="/terms">Terms</a>.
        </p>
      </form>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", background: "#070B15", color: "#E5E9F0", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "system-ui, -apple-system, sans-serif" },
  card: { width: "100%", maxWidth: 480, background: "#0E1526", border: "1px solid #1E2A44", borderRadius: 16, padding: 28, display: "flex", flexDirection: "column" },
  kicker: { fontSize: 13, fontWeight: 800, color: "#34D399", letterSpacing: 0.4 },
  h1: { fontSize: 28, fontWeight: 800, margin: "8px 0 8px", lineHeight: 1.15 },
  sub: { fontSize: 15, lineHeight: 1.6, color: "#98A2B6", margin: "0 0 20px" },
  label: { fontSize: 13, color: "#B8C0D0", margin: "12px 0 6px", fontWeight: 600 },
  opt: { color: "#6B7484", fontWeight: 400 },
  input: { background: "#0A0F1E", border: "1px solid #24324F", borderRadius: 10, padding: "12px 14px", color: "#E5E9F0", fontSize: 15, width: "100%" },
  error: { background: "#3A1620", color: "#F7A8B8", padding: "10px 12px", borderRadius: 8, fontSize: 13, marginTop: 14 },
  submit: { marginTop: 20, background: "#3B82F6", color: "#fff", border: "none", borderRadius: 10, padding: "13px 16px", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  fine: { fontSize: 12, color: "#6B7484", marginTop: 12, lineHeight: 1.5 },
  link: { color: "#8FB8FF" },
  steps: { listStyle: "none", padding: 0, margin: "0 0 22px", display: "flex", flexDirection: "column", gap: 12, counterReset: "step" },
  step: { background: "#0A0F1E", border: "1px solid #1C2740", borderRadius: 10, padding: "12px 14px", fontSize: 14, lineHeight: 1.55, color: "#C7CEDB" },
  fwdBox: { background: "#0A0F1E", border: "1px solid #24324F", borderRadius: 12, padding: 16, marginBottom: 20 },
  fwdTitle: { fontSize: 15, fontWeight: 700, marginBottom: 8 },
  fwdIntro: { fontSize: 13.5, color: "#98A2B6", margin: "0 0 10px", lineHeight: 1.55 },
  fwdList: { margin: 0, paddingLeft: 18, fontSize: 13.5, color: "#C7CEDB", lineHeight: 1.9 },
  fwdNote: { fontSize: 12.5, color: "#6B7484", margin: "10px 0 0", lineHeight: 1.5 },
  code: { background: "#1B2740", color: "#9FC2FF", padding: "1px 6px", borderRadius: 5, fontSize: 13 },
  cta: { display: "inline-block", color: "#8FB8FF", fontSize: 15, fontWeight: 700, textDecoration: "none" },
};
