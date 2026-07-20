"use client";

import * as React from "react";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface Business {
  id: number;
  businessName: string;
  businessPhone: string;
  ownerPhone: string;
  ownerEmail: string;
  missedCallMessage: string;
  voiceGreeting: string;
  smsEnabled: boolean;
  voiceEnabled: boolean;
  recordVoicemail: boolean;
}

type FormState = {
  businessName: string;
  businessPhone: string;
  ownerPhone: string;
  ownerEmail: string;
  missedCallMessage: string;
  voiceGreeting: string;
  smsEnabled: boolean;
  voiceEnabled: boolean;
  recordVoicemail: boolean;
};

const EMPTY_FORM: FormState = {
  businessName: "",
  businessPhone: "",
  ownerPhone: "",
  ownerEmail: "",
  missedCallMessage: "",
  voiceGreeting: "",
  smsEnabled: true,
  voiceEnabled: false,
  recordVoicemail: false,
};

const KEY_STORAGE = "admin_api_key";

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function AdminBusinessesPage() {
  const [adminKey, setAdminKey] = React.useState("");
  const [authed, setAuthed] = React.useState(false);
  const [keyInput, setKeyInput] = React.useState("");

  const [businesses, setBusinesses] = React.useState<Business[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);

  // Load a saved key on first render
  React.useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(KEY_STORAGE) : null;
    if (saved) {
      setAdminKey(saved);
      setAuthed(true);
    }
  }, []);

  const fetchBusinesses = React.useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/businesses", { headers: { "x-admin-key": key } });
      if (res.status === 401) {
        setAuthed(false);
        setAdminKey("");
        window.localStorage.removeItem(KEY_STORAGE);
        setError("Invalid admin key.");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Request failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setBusinesses(data.businesses ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (authed && adminKey) fetchBusinesses(adminKey);
  }, [authed, adminKey, fetchBusinesses]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const k = keyInput.trim();
    if (!k) return;
    window.localStorage.setItem(KEY_STORAGE, k);
    setAdminKey(k);
    setAuthed(true);
  }

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setNotice(null);
    setError(null);
  }

  function startEdit(b: Business) {
    setEditingId(b.id);
    setForm({
      businessName: b.businessName,
      businessPhone: b.businessPhone,
      ownerPhone: b.ownerPhone,
      ownerEmail: b.ownerEmail,
      missedCallMessage: b.missedCallMessage,
      voiceGreeting: b.voiceGreeting,
      smsEnabled: b.smsEnabled,
      voiceEnabled: b.voiceEnabled,
      recordVoicemail: b.recordVoicemail,
    });
    setNotice(null);
    setError(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const url = editingId ? `/api/admin/businesses/${editingId}` : "/api/admin/businesses";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify(form),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || `Save failed (${res.status})`);
        return;
      }
      setNotice(editingId ? "Business updated." : "Business created.");
      setForm(EMPTY_FORM);
      setEditingId(null);
      fetchBusinesses(adminKey);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/businesses/${id}`, {
        method: "DELETE",
        headers: { "x-admin-key": adminKey },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || `Delete failed (${res.status})`);
        return;
      }
      setNotice("Business deleted.");
      if (editingId === id) {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }
      fetchBusinesses(adminKey);
    } catch (err) {
      setError(String(err));
    }
  }

  function logout() {
    window.localStorage.removeItem(KEY_STORAGE);
    setAdminKey("");
    setAuthed(false);
    setBusinesses([]);
    setKeyInput("");
  }

  /* ── Login gate ── */
  if (!authed) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.h1}>Business Admin</h1>
          <p style={styles.muted}>Enter your admin key to manage businesses.</p>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Admin API key"
              style={styles.input}
              autoFocus
            />
            <button type="submit" style={styles.primaryBtn}>Continue</button>
          </form>
          {error && <p style={styles.error}>{error}</p>}
        </div>
      </div>
    );
  }

  /* ── Main admin ── */
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.h1}>Business Admin</h1>
            <p style={styles.muted}>Add and configure businesses in the missed-call system.</p>
          </div>
          <button onClick={logout} style={styles.ghostBtn}>Sign out</button>
        </header>

        {error && <div style={styles.errorBanner}>{error}</div>}
        {notice && <div style={styles.noticeBanner}>{notice}</div>}

        {/* Form */}
        <section style={styles.card}>
          <h2 style={styles.h2}>{editingId ? `Edit business #${editingId}` : "Add a business"}</h2>
          <form onSubmit={handleSubmit}>
            <div style={styles.grid}>
              <Field label="Business name *">
                <input style={styles.input} value={form.businessName}
                  onChange={(e) => setForm({ ...form, businessName: e.target.value })} required />
              </Field>
              <Field label="Twilio number (customers call) *">
                <input style={styles.input} value={form.businessPhone} placeholder="+18476131968"
                  onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} required />
              </Field>
              <Field label="Owner phone (alerts) *">
                <input style={styles.input} value={form.ownerPhone} placeholder="+18472714087"
                  onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })} required />
              </Field>
              <Field label="Owner email (alerts) *">
                <input style={styles.input} type="email" value={form.ownerEmail}
                  onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} required />
              </Field>
            </div>

            <Field label="Text-back message (sent to caller)">
              <textarea style={styles.textarea} rows={2} value={form.missedCallMessage}
                placeholder="Sorry we missed your call! What can we help with?"
                onChange={(e) => setForm({ ...form, missedCallMessage: e.target.value })} />
            </Field>

            <Field label="Spoken greeting (used only if voice is on)">
              <textarea style={styles.textarea} rows={2} value={form.voiceGreeting}
                placeholder="Thanks for calling — we're with a customer and will text you now."
                onChange={(e) => setForm({ ...form, voiceGreeting: e.target.value })} />
            </Field>

            <div style={styles.toggleRow}>
              <label style={styles.toggle}>
                <input type="checkbox" checked={form.smsEnabled}
                  onChange={(e) => setForm({ ...form, smsEnabled: e.target.checked })} /> Send text-back
              </label>
              <label style={styles.toggle}>
                <input type="checkbox" checked={form.voiceEnabled}
                  onChange={(e) => setForm({ ...form, voiceEnabled: e.target.checked })} /> Answer with voice
              </label>
              <label style={styles.toggle}>
                <input type="checkbox" checked={form.recordVoicemail}
                  onChange={(e) => setForm({ ...form, recordVoicemail: e.target.checked })} /> Record voicemail
              </label>
            </div>

            <div style={styles.formActions}>
              <button type="submit" style={styles.primaryBtn} disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Create business"}
              </button>
              {editingId && (
                <button type="button" style={styles.ghostBtn} onClick={startCreate}>Cancel edit</button>
              )}
            </div>
          </form>
        </section>

        {/* List */}
        <section style={styles.card}>
          <h2 style={styles.h2}>Businesses {loading ? "…" : `(${businesses.length})`}</h2>
          {businesses.length === 0 && !loading && <p style={styles.muted}>No businesses yet.</p>}
          <div>
            {businesses.map((b) => (
              <div key={b.id} style={styles.row}>
                <div>
                  <div style={styles.rowTitle}>{b.businessName}</div>
                  <div style={styles.rowSub}>
                    {b.businessPhone} · {b.smsEnabled ? "Text" : "No text"}{b.voiceEnabled ? " + Voice" : ""}
                  </div>
                </div>
                <div style={styles.rowActions}>
                  <button style={styles.smallBtn} onClick={() => startEdit(b)}>Edit</button>
                  <button style={styles.smallDangerBtn} onClick={() => handleDelete(b.id, b.businessName)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

/* ─── Inline styles (self-contained, dark theme) ─────────────────────────── */

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#080D1A", color: "#E5E9F0", padding: "32px 16px", fontFamily: "system-ui, -apple-system, sans-serif" },
  container: { maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  card: { background: "#0E1526", border: "1px solid #1E2A44", borderRadius: 12, padding: 20, maxWidth: 460, margin: "0 auto", width: "100%" },
  h1: { fontSize: 24, fontWeight: 700, margin: 0 },
  h2: { fontSize: 18, fontWeight: 600, margin: "0 0 16px" },
  muted: { color: "#8A93A6", fontSize: 14, margin: "4px 0 16px" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 },
  field: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 },
  fieldLabel: { fontSize: 13, color: "#B8C0D0" },
  input: { background: "#0A0F1E", border: "1px solid #24324F", borderRadius: 8, padding: "10px 12px", color: "#E5E9F0", fontSize: 14, width: "100%" },
  textarea: { background: "#0A0F1E", border: "1px solid #24324F", borderRadius: 8, padding: "10px 12px", color: "#E5E9F0", fontSize: 14, width: "100%", resize: "vertical" },
  toggleRow: { display: "flex", flexWrap: "wrap", gap: 16, margin: "8px 0 16px" },
  toggle: { display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#C7CEDB" },
  formActions: { display: "flex", gap: 10 },
  primaryBtn: { background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%" },
  ghostBtn: { background: "transparent", color: "#B8C0D0", border: "1px solid #24324F", borderRadius: 8, padding: "10px 16px", fontSize: 14, cursor: "pointer" },
  smallBtn: { background: "#1B2740", color: "#E5E9F0", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer" },
  smallDangerBtn: { background: "#3A1620", color: "#F7A8B8", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer" },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid #1A2338" },
  rowTitle: { fontSize: 15, fontWeight: 600 },
  rowSub: { fontSize: 13, color: "#8A93A6", marginTop: 2 },
  rowActions: { display: "flex", gap: 8 },
  error: { color: "#F7A8B8", fontSize: 14, marginTop: 12 },
  errorBanner: { background: "#3A1620", color: "#F7A8B8", padding: "10px 14px", borderRadius: 8, fontSize: 14 },
  noticeBanner: { background: "#12301F", color: "#8FE3B0", padding: "10px 14px", borderRadius: 8, fontSize: 14 },
};
