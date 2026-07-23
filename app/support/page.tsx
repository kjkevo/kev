"use client";

import * as React from "react";

export default function SupportPage() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
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
        <div style={s.brand}>Recover · Support</div>
        <h1 style={s.h1}>How can we help?</h1>
        <p style={s.sub}>
          Send us a message and we&apos;ll get back to you by email. For urgent issues, include
          &ldquo;URGENT&rdquo; in the subject.
        </p>

        {done ? (
          <div style={s.success}>
            ✅ Thanks, {name || "there"}! Your message was received — we&apos;ll reply at {email}.
          </div>
        ) : (
          <form onSubmit={submit}>
            <label style={s.label}>
              Name <span style={s.req}>*</span>
              <input style={s.input} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label style={s.label}>
              Email <span style={s.req}>*</span>
              <input style={s.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label style={s.label}>
              Subject
              <input style={s.input} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What's this about?" />
            </label>
            <label style={s.label}>
              Message <span style={s.req}>*</span>
              <textarea style={s.textarea} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} required />
            </label>

            {error && <div style={s.error}>{error}</div>}

            <button type="submit" style={s.button} disabled={submitting}>
              {submitting ? "Sending…" : "Send message"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", background: "#070B15", color: "#E5E9F0", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px", fontFamily: "system-ui, -apple-system, sans-serif" },
  card: { width: "100%", maxWidth: 480, background: "#0E1526", border: "1px solid #1E2A44", borderRadius: 16, padding: 28 },
  brand: { fontSize: 13, fontWeight: 700, color: "#34D399", textTransform: "uppercase", letterSpacing: 0.6 },
  h1: { fontSize: 26, fontWeight: 800, margin: "8px 0 6px" },
  sub: { fontSize: 14, color: "#8A93A6", lineHeight: 1.5, margin: "0 0 20px" },
  label: { display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5, color: "#B8C0D0", marginBottom: 14 },
  req: { color: "#F7A8B8" },
  input: { background: "#0A0F1E", border: "1px solid #24324F", borderRadius: 8, padding: "10px 12px", color: "#E5E9F0", fontSize: 15, width: "100%" },
  textarea: { background: "#0A0F1E", border: "1px solid #24324F", borderRadius: 8, padding: "10px 12px", color: "#E5E9F0", fontSize: 15, width: "100%", resize: "vertical" },
  button: { width: "100%", background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, padding: "12px 16px", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  error: { background: "#3A1620", color: "#F7A8B8", padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 },
  success: { background: "#12301F", color: "#8FE3B0", padding: "16px", borderRadius: 10, fontSize: 15, lineHeight: 1.5 },
};
