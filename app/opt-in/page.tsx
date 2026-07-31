"use client";

import * as React from "react";

export default function OptInPage() {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [service, setService] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/opt-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, service, consent }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={s.wrap}>
      <div style={s.card}>
        <div style={s.brand}>Simplicity Pleasing</div>
        <h1 style={s.h1}>Get in touch</h1>
        <p style={s.sub}>
          Simplicity Pleasing helps you book DJing, photo booths, and party decoration for your
          event. Send us your details below and we&apos;ll follow up to help plan it.
        </p>
        <p style={s.info}>
          Prefer a text reply? Checking the optional box below lets us text you about your
          inquiry — it&apos;s completely optional and never required to contact us.
        </p>

        {done ? (
          <div style={s.success}>
            ✅ Thanks! We&apos;ve got your info and will follow up. If you opted in to texts, we&apos;ll
            message you shortly at the number you provided.
          </div>
        ) : (
          <form onSubmit={submit}>
            <label style={s.label}>
              Name
              <input style={s.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </label>

            <label style={s.label}>
              Mobile number <span style={s.req}>*</span>
              <input style={s.input} value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="(847) 555-1234" type="tel" required />
            </label>

            <label style={s.label}>
              Service
              <select style={s.input} value={service} onChange={(e) => setService(e.target.value)}>
                <option value="">Select a service…</option>
                <option>DJing</option>
                <option>Photo booth</option>
                <option>Party decoration</option>
                <option>Other</option>
              </select>
            </label>

            <label style={s.consentRow}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={s.checkbox} />
              <span style={s.consentText}>
                <strong>(Optional)</strong> By checking this box, I agree to receive automated text
                messages from <strong>Simplicity Pleasing</strong> at the mobile number I provide, about
                my inquiry. This is optional and not a condition of contacting us or any purchase.
                Message frequency varies; message and data rates may apply. Reply <strong>STOP</strong>{" "}
                to opt out or <strong>HELP</strong> for help. See our{" "}
                <a style={s.link} href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>{" "}
                and{" "}
                <a style={s.link} href="/terms" target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</a>.
              </span>
            </label>

            {error && <div style={s.error}>{error}</div>}

            <button type="submit" style={s.button} disabled={submitting}>
              {submitting ? "Sending…" : "Send my info"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", background: "#070B15", color: "#E5E9F0", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px", fontFamily: "system-ui, -apple-system, sans-serif" },
  card: { width: "100%", maxWidth: 460, background: "#0E1526", border: "1px solid #1E2A44", borderRadius: 16, padding: 28 },
  brand: { fontSize: 13, fontWeight: 700, color: "#34D399", textTransform: "uppercase", letterSpacing: 0.6 },
  h1: { fontSize: 26, fontWeight: 800, margin: "8px 0 6px" },
  sub: { fontSize: 14, color: "#8A93A6", lineHeight: 1.5, margin: "0 0 12px" },
  info: { fontSize: 13, color: "#7FBFA0", lineHeight: 1.5, margin: "0 0 20px", background: "#0A1F16", border: "1px solid #1F5A3E", borderRadius: 8, padding: "10px 12px" },
  label: { display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5, color: "#B8C0D0", marginBottom: 14 },
  req: { color: "#F7A8B8" },
  input: { background: "#0A0F1E", border: "1px solid #24324F", borderRadius: 8, padding: "10px 12px", color: "#E5E9F0", fontSize: 15, width: "100%" },
  consentRow: { display: "flex", gap: 10, alignItems: "flex-start", margin: "6px 0 18px" },
  checkbox: { marginTop: 3, width: 18, height: 18, flexShrink: 0 },
  consentText: { fontSize: 12.5, color: "#AAB2C2", lineHeight: 1.5 },
  link: { color: "#8FB8FF" },
  button: { width: "100%", background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, padding: "12px 16px", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  error: { background: "#3A1620", color: "#F7A8B8", padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 },
  success: { background: "#12301F", color: "#8FE3B0", padding: "16px", borderRadius: 10, fontSize: 15, lineHeight: 1.5 },
};
