"use client";

import * as React from "react";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface MenuOptionJSON { label: string; keywords: string[]; reply: string; sms: string }
interface VoiceMenuJSON {
  enabled?: boolean;
  prompt?: string;
  options?: MenuOptionJSON[];
  fallbackReply?: string;
  fallbackSms?: string;
}

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
  voiceMenu?: VoiceMenuJSON | null;
}

interface TrialSignup {
  id: number;
  createdAt: string;
  businessName: string;
  mobile: string;
  email: string;
  trade?: string | null;
  status: string;
  notes?: string | null;
}

// In the form, an option's keywords are a single comma-separated string for
// easy editing; the API splits them back into an array.
interface MenuOptionForm { label: string; keywords: string; reply: string; sms: string }

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
  voiceMenuEnabled: boolean;
  voiceMenuPrompt: string;
  voiceMenuOptions: MenuOptionForm[];
  voiceMenuFallbackReply: string;
  voiceMenuFallbackSms: string;
};

const EMPTY_MENU_OPTION: MenuOptionForm = { label: "", keywords: "", reply: "", sms: "" };

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
  voiceMenuEnabled: false,
  voiceMenuPrompt: "Thanks for calling {BUSINESS_NAME}! What are you calling about? You can say DJ, photo booth, or decorations.",
  voiceMenuOptions: [{ ...EMPTY_MENU_OPTION }],
  voiceMenuFallbackReply: "No problem — we'll text you now to help.",
  voiceMenuFallbackSms: "Thanks for calling {BUSINESS_NAME}! What service can we help you with?",
};

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function AdminBusinessesPage() {
  const [businesses, setBusinesses] = React.useState<Business[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);

  const [signups, setSignups] = React.useState<TrialSignup[]>([]);
  const [provisioningId, setProvisioningId] = React.useState<number | null>(null);

  const fetchBusinesses = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/businesses");
      if (res.status === 401) {
        window.location.href = "/login?next=/admin";
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

  const fetchSignups = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/signups");
      if (!res.ok) return;
      const data = await res.json();
      setSignups(data.signups ?? []);
    } catch {
      /* non-critical — the signup queue just stays empty */
    }
  }, []);

  React.useEffect(() => {
    fetchBusinesses();
    fetchSignups();
  }, [fetchBusinesses, fetchSignups]);

  async function handleProvision(s: TrialSignup) {
    if (!window.confirm(
      `Provision ${s.businessName}?\n\nThis buys a Twilio number, wires its webhooks, ` +
      `creates the business, and emails ${s.email} their number + forwarding steps.`
    )) return;
    setProvisioningId(s.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/signups/${s.id}/provision`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || `Provisioning failed (${res.status})`);
        return;
      }
      setNotice(
        `${s.businessName} is live on ${j.phoneNumber}` +
        (j.mock ? " (mock number — Twilio isn't configured yet)." : ". We emailed them the forwarding steps.")
      );
      fetchSignups();
      fetchBusinesses();
    } catch (err) {
      setError(String(err));
    } finally {
      setProvisioningId(null);
    }
  }

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setNotice(null);
    setError(null);
  }

  function startEdit(b: Business) {
    setEditingId(b.id);
    const menu = b.voiceMenu ?? null;
    const options: MenuOptionForm[] = Array.isArray(menu?.options) && menu!.options!.length > 0
      ? menu!.options!.map((o) => ({
          label: o.label ?? "",
          keywords: Array.isArray(o.keywords) ? o.keywords.join(", ") : "",
          reply: o.reply ?? "",
          sms: o.sms ?? "",
        }))
      : [{ ...EMPTY_MENU_OPTION }];
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
      voiceMenuEnabled: Boolean(menu?.enabled),
      voiceMenuPrompt: menu?.prompt || EMPTY_FORM.voiceMenuPrompt,
      voiceMenuOptions: options,
      voiceMenuFallbackReply: menu?.fallbackReply || EMPTY_FORM.voiceMenuFallbackReply,
      voiceMenuFallbackSms: menu?.fallbackSms || EMPTY_FORM.voiceMenuFallbackSms,
    });
    setNotice(null);
    setError(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateMenuOption(index: number, patch: Partial<MenuOptionForm>) {
    setForm((f) => ({
      ...f,
      voiceMenuOptions: f.voiceMenuOptions.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const url = editingId ? `/api/admin/businesses/${editingId}` : "/api/admin/businesses";
      const method = editingId ? "PATCH" : "POST";
      const {
        voiceMenuEnabled, voiceMenuPrompt, voiceMenuOptions,
        voiceMenuFallbackReply, voiceMenuFallbackSms, ...rest
      } = form;
      const payload = {
        ...rest,
        voiceMenu: {
          enabled: voiceMenuEnabled,
          prompt: voiceMenuPrompt,
          options: voiceMenuOptions.map((o) => ({
            label: o.label,
            keywords: o.keywords, // API splits the comma-separated string
            reply: o.reply,
            sms: o.sms,
          })),
          fallbackReply: voiceMenuFallbackReply,
          fallbackSms: voiceMenuFallbackSms,
        },
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || `Save failed (${res.status})`);
        return;
      }
      setNotice(editingId ? "Business updated." : "Business created.");
      setForm(EMPTY_FORM);
      setEditingId(null);
      fetchBusinesses();
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
      fetchBusinesses();
    } catch (err) {
      setError(String(err));
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

  /* ── Main admin ── */
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.h1}>Business Admin</h1>
            <p style={styles.muted}>Add and configure businesses in the missed-call system.</p>
          </div>
          <button onClick={signOut} style={styles.ghostBtn}>Sign out</button>
        </header>

        {error && <div style={styles.errorBanner}>{error}</div>}
        {notice && <div style={styles.noticeBanner}>{notice}</div>}

        {/* Trial signup queue */}
        <section style={styles.card}>
          <h2 style={styles.h2}>
            Trial signups
            {signups.filter((s) => s.status !== "onboarded").length > 0 &&
              ` · ${signups.filter((s) => s.status !== "onboarded").length} new`}
          </h2>
          <p style={styles.muted}>
            One click buys a number, wires the webhooks, creates the business, and emails the
            client their forwarding steps.
          </p>
          {signups.length === 0 && <p style={styles.muted}>No signups yet.</p>}
          {signups.map((s) => {
            const done = s.status === "onboarded";
            return (
              <div key={s.id} style={styles.row}>
                <div>
                  <div style={styles.rowTitle}>
                    {s.businessName}{" "}
                    <span style={done ? styles.pillDone : styles.pillNew}>{done ? "Live" : "New"}</span>
                  </div>
                  <div style={styles.rowSub}>
                    {s.mobile} · {s.email}{s.trade ? ` · ${s.trade}` : ""}
                  </div>
                </div>
                <div style={styles.rowActions}>
                  {done ? (
                    <span style={styles.mutedSmall}>Provisioned</span>
                  ) : (
                    <button
                      style={styles.provisionBtn}
                      disabled={provisioningId === s.id}
                      onClick={() => handleProvision(s)}
                    >
                      {provisioningId === s.id ? "Provisioning…" : "⚡ Provision"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </section>

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
            {form.recordVoicemail && (
              <p style={styles.muted}>
                When recording is on, callers automatically hear a spoken recording notice before the
                beep (with the option to hang up and text instead), and the text-back includes a written
                recording notice — no extra setup needed.
              </p>
            )}

            {/* Keyword voice menu (only meaningful when voice is on) */}
            {form.voiceEnabled && (
              <div style={styles.menuBox}>
                <label style={styles.toggle}>
                  <input type="checkbox" checked={form.voiceMenuEnabled}
                    onChange={(e) => setForm({ ...form, voiceMenuEnabled: e.target.checked })} />
                  <strong>Keyword voice menu</strong> — caller says a service, hears a reply, gets a matching text
                </label>

                {form.voiceMenuEnabled && (
                  <div style={{ marginTop: 12 }}>
                    <Field label="Spoken question (use {BUSINESS_NAME} to insert the name)">
                      <textarea style={styles.textarea} rows={2} value={form.voiceMenuPrompt}
                        onChange={(e) => setForm({ ...form, voiceMenuPrompt: e.target.value })} />
                    </Field>

                    <p style={styles.muted}>
                      Add a row per service. Callers can also press 1, 2, 3… matching the order below.
                    </p>

                    {form.voiceMenuOptions.map((opt, i) => (
                      <div key={i} style={styles.menuOption}>
                        <div style={styles.menuOptionHead}>
                          <span style={styles.menuOptionNum}>Press {i + 1} / say…</span>
                          {form.voiceMenuOptions.length > 1 && (
                            <button type="button" style={styles.smallDangerBtn}
                              onClick={() => setForm({ ...form, voiceMenuOptions: form.voiceMenuOptions.filter((_, j) => j !== i) })}>
                              Remove
                            </button>
                          )}
                        </div>
                        <div style={styles.grid}>
                          <Field label="Service name">
                            <input style={styles.input} value={opt.label} placeholder="DJ"
                              onChange={(e) => updateMenuOption(i, { label: e.target.value })} />
                          </Field>
                          <Field label="Keywords they might say (comma-separated)">
                            <input style={styles.input} value={opt.keywords} placeholder="dj, djing, music"
                              onChange={(e) => updateMenuOption(i, { keywords: e.target.value })} />
                          </Field>
                        </div>
                        <Field label="Spoken reply">
                          <textarea style={styles.textarea} rows={2} value={opt.reply}
                            placeholder="Great — our DJ team will reach out shortly."
                            onChange={(e) => updateMenuOption(i, { reply: e.target.value })} />
                        </Field>
                        <Field label="Text-back for this service">
                          <textarea style={styles.textarea} rows={2} value={opt.sms}
                            placeholder="Thanks for calling about DJ services! What date are you looking at?"
                            onChange={(e) => updateMenuOption(i, { sms: e.target.value })} />
                        </Field>
                      </div>
                    ))}

                    <button type="button" style={styles.ghostBtn}
                      onClick={() => setForm({ ...form, voiceMenuOptions: [...form.voiceMenuOptions, { ...EMPTY_MENU_OPTION }] })}>
                      + Add service
                    </button>

                    <div style={{ marginTop: 16 }}>
                      <Field label="If nothing matches — spoken reply">
                        <input style={styles.input} value={form.voiceMenuFallbackReply}
                          onChange={(e) => setForm({ ...form, voiceMenuFallbackReply: e.target.value })} />
                      </Field>
                      <Field label="If nothing matches — text-back">
                        <textarea style={styles.textarea} rows={2} value={form.voiceMenuFallbackSms}
                          onChange={(e) => setForm({ ...form, voiceMenuFallbackSms: e.target.value })} />
                      </Field>
                    </div>
                  </div>
                )}
              </div>
            )}

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
  menuBox: { border: "1px solid #24324F", borderRadius: 10, padding: 14, margin: "8px 0 16px", background: "#0B1220" },
  menuOption: { border: "1px solid #1E2A44", borderRadius: 8, padding: 12, marginBottom: 12, background: "#0E1526" },
  menuOptionHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  menuOptionNum: { fontSize: 13, fontWeight: 600, color: "#9FC2FF" },
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
  mutedSmall: { color: "#8A93A6", fontSize: 13 },
  provisionBtn: { background: "#12B886", color: "#04140D", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  pillNew: { background: "#12301F", color: "#8FE3B0", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, marginLeft: 6, verticalAlign: "middle" },
  pillDone: { background: "#1B2740", color: "#9FC2FF", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, marginLeft: 6, verticalAlign: "middle" },
  error: { color: "#F7A8B8", fontSize: 14, marginTop: 12 },
  errorBanner: { background: "#3A1620", color: "#F7A8B8", padding: "10px 14px", borderRadius: 8, fontSize: 14 },
  noticeBanner: { background: "#12301F", color: "#8FE3B0", padding: "10px 14px", borderRadius: 8, fontSize: 14 },
};
