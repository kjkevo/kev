"use client";

import * as React from "react";

export default function LoginPage() {
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/owner-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Login failed.");
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/dashboard";
      window.location.href = next.startsWith("/") ? next : "/dashboard";
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={s.wrap}>
      <form style={s.card} onSubmit={submit}>
        <div style={s.brand}>◆ Recover</div>
        <h1 style={s.h1}>Owner sign-in</h1>
        <p style={s.sub}>Enter your owner password to access your dashboard.</p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Owner password"
          style={s.input}
          autoFocus
        />
        {error && <div style={s.error}>{error}</div>}
        <button type="submit" style={s.button} disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", background: "#070B15", color: "#E5E9F0", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px", fontFamily: "system-ui, -apple-system, sans-serif" },
  card: { width: "100%", maxWidth: 380, background: "#0E1526", border: "1px solid #1E2A44", borderRadius: 16, padding: 28, display: "flex", flexDirection: "column" },
  brand: { fontSize: 14, fontWeight: 800, color: "#34D399" },
  h1: { fontSize: 24, fontWeight: 800, margin: "10px 0 4px" },
  sub: { fontSize: 14, color: "#8A93A6", margin: "0 0 20px" },
  input: { background: "#0A0F1E", border: "1px solid #24324F", borderRadius: 8, padding: "12px 12px", color: "#E5E9F0", fontSize: 15, width: "100%", marginBottom: 12 },
  button: { width: "100%", background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, padding: "12px 16px", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  error: { background: "#3A1620", color: "#F7A8B8", padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 },
};
