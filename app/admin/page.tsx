"use client";

import * as React from "react";
import { ONBOARDING_SECTIONS } from "@/app/lib/onboardingSchema";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface Client {
  signupId: number | null;
  businessId: number | null;
  businessName: string;
  email: string;
  mobile: string;
  trade: string | null;
  servicePreference: string | null;
  onboardingDetails: Record<string, string> | null;
  intakeSubmitted: boolean;
  active: boolean | null;
  subscriptionStatus: string | null;
  category: "paying" | "trial" | "review" | "new";
  stage: string;
  billDate: string | null;
}

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
  active?: boolean;
  trialEndsAt?: string | null;
  subscriptionStatus?: string | null;
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

interface AnalyticsRow {
  businessId: number;
  businessName: string;
  totalMissedCalls: number;
  recoveryRate: number;
  conversions: number;
  recoveredRevenue: number;
  avgResponseSeconds: number | null;
}
interface Analytics { overall: AnalyticsRow; perBusiness: AnalyticsRow[] }

interface OverviewRow {
  id: number;
  businessName: string;
  businessPhone: string;
  callsTotal: number;
  callsWeek: number;
  health: "green" | "yellow" | "red";
  reason: string;
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

  const [analytics, setAnalytics] = React.useState<Analytics | null>(null);
  const [testingEmail, setTestingEmail] = React.useState(false);
  const [pipeline, setPipeline] = React.useState<Client[]>([]);
  const [openForm, setOpenForm] = React.useState<number | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<string>("overview");
  const [overview, setOverview] = React.useState<OverviewRow[]>([]);

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

  const fetchAnalytics = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/analytics");
      if (!res.ok) return;
      setAnalytics(await res.json());
    } catch {
      /* non-critical */
    }
  }, []);

  const fetchPipeline = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pipeline");
      if (!res.ok) return;
      const j = await res.json();
      setPipeline(j.clients || []);
    } catch {
      /* non-critical */
    }
  }, []);

  const fetchOverview = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overview");
      if (!res.ok) return;
      const j = await res.json();
      setOverview(j.businesses || []);
    } catch {
      /* non-critical */
    }
  }, []);

  React.useEffect(() => {
    fetchBusinesses();
    fetchAnalytics();
    fetchPipeline();
    fetchOverview();
  }, [fetchBusinesses, fetchAnalytics, fetchPipeline, fetchOverview]);

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

  async function sendTestEmail() {
    setError(null);
    setNotice(null);
    setTestingEmail(true);
    try {
      const res = await fetch("/api/admin/test-email", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setNotice(`✅ Test email sent to ${j.to || "your inbox"} — check it (and your spam folder).`);
      } else {
        setError(j.error || `Email test failed (${res.status})`);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setTestingEmail(false);
    }
  }

  function refreshAll() { fetchBusinesses(); fetchPipeline(); fetchOverview(); }

  async function patchBusiness(id: number, body: Record<string, unknown>, okMsg: string) {
    setError(null); setNotice(null);
    try {
      const res = await fetch(`/api/admin/businesses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) { setNotice(okMsg); refreshAll(); }
      else setError(j.error || `Update failed (${res.status})`);
    } catch (e) { setError(String(e)); }
  }

  function setActive(id: number, name: string, active: boolean) {
    if (!active && !confirm(`Turn OFF ${name}? Their missed-call texts will stop until you turn it back on.`)) return;
    patchBusiness(id, { active }, `${name} turned ${active ? "on" : "off"}.`);
  }
  function extendTrial(id: number, name: string, days: number) {
    patchBusiness(id, { extendDays: days }, `Extended ${name}'s trial by ${days} days.`);
  }

  // POST helper for the workflow endpoints, with a per-row busy key.
  async function postAction(key: string, url: string, okMsg: string, confirmMsg?: string, body?: unknown) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setError(null); setNotice(null); setBusyId(key);
    try {
      const res = await fetch(url, {
        method: "POST",
        ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) { setNotice(okMsg); refreshAll(); }
      else setError(j.error || `Action failed (${res.status})`);
    } catch (e) { setError(String(e)); }
    finally { setBusyId(null); }
  }

  function cancelDecision(c: Client, decision: "confirm" | "keep") {
    const msg = decision === "confirm"
      ? `Confirm cancellation for ${c.businessName}? Their service stays off. (Release their Twilio number if you bought one.)`
      : `Keep ${c.businessName} and turn their service back on?`;
    postAction(`cd-${c.signupId}`, `/api/admin/signups/${c.signupId}/cancel-decision`,
      decision === "confirm" ? `${c.businessName} cancelled.` : `${c.businessName} kept — service back on.`,
      msg, { decision });
  }

  function provisionClient(c: Client) {
    postAction(`prov-${c.signupId}`, `/api/admin/signups/${c.signupId}/provision`,
      `Built ${c.businessName}'s service. Review it in Businesses below, then start their trial.`,
      `Build ${c.businessName}?\n\nThis buys a Twilio number and creates their service (turned OFF). It won't start their trial yet.`);
  }
  function startTrial(c: Client) {
    postAction(`start-${c.businessId}`, `/api/admin/businesses/${c.businessId}/start-trial`,
      `${c.businessName} is live — 14-day free trial started. We emailed them their number.`,
      `Start ${c.businessName}'s 14-day free trial now?\n\nThis turns their service ON and emails them their number + forwarding steps.`);
  }
  function sendConfirmation(c: Client) {
    postAction(`conf-${c.businessId}`, `/api/admin/businesses/${c.businessId}/send-confirmation`,
      `Confirmation email sent to ${c.email}.`);
  }
  function cancelSubscription(c: Client) {
    postAction(`sub-${c.businessId}`, `/api/admin/businesses/${c.businessId}/cancel-subscription`,
      `${c.businessName}'s subscription cancelled and service turned off.`,
      `Cancel ${c.businessName}'s subscription?\n\nThis stops their billing in Stripe and turns their service OFF.`);
  }
  function removeClient(c: Client) {
    postAction(`rm-${c.businessId}`, `/api/admin/businesses/${c.businessId}/remove`,
      `${c.businessName} removed from services.`,
      `Remove ${c.businessName} from your services?\n\nThis cancels any subscription, turns their service OFF, and takes them out of your dashboard. (History is kept.)`);
  }
  function deleteSignup(c: Client) {
    postAction(`del-${c.signupId}`, `/api/admin/signups/${c.signupId}/delete`,
      `${c.businessName} deleted.`,
      `Permanently DELETE ${c.businessName}?\n\nThis erases the signup and any service, number history, and call/lead records tied to it. This cannot be undone. (Use "Remove" instead if you just want to offboard a real client and keep their history.)`);
  }

  function stageLabel(c: Client): string {
    switch (c.stage) {
      case "form_in": return "Form submitted — review & build";
      case "built": return "Built — ready to start trial";
      case "trial": {
        const d = c.billDate ? Math.ceil((new Date(c.billDate).getTime() - Date.now()) / 86400000) : 0;
        return `On trial · ${d}d left`;
      }
      case "trial_ended": return "Trial ended — unpaid";
      case "paying": return "Paying";
      case "no_form": return "Waiting on their form";
      case "cancel_requested": return "Cancellation requested — service off";
      default: return c.stage;
    }
  }

  function renderForm(c: Client) {
    const d = c.onboardingDetails || {};
    return (
      <div style={styles.formPanel}>
        <div style={styles.formLine}>
          <strong>Service wanted:</strong>{" "}
          {c.servicePreference === "both" ? "Voice + Text" : c.servicePreference === "voice" ? "Voice" : c.servicePreference === "text" ? "Text" : "—"}
        </div>
        {ONBOARDING_SECTIONS.map((section) => {
          const rows = section.fields.filter((f) => d[f.id]);
          if (rows.length === 0) return null;
          return (
            <div key={section.title} style={{ marginTop: 10 }}>
              <div style={styles.formSectionTitle}>{section.title}</div>
              {rows.map((f) => (
                <div key={f.id} style={styles.formLine}><strong>{f.label}</strong><br />{d[f.id]}</div>
              ))}
            </div>
          );
        })}
        {Object.keys(d).length === 0 && <div style={styles.formLine}>No extra details provided.</div>}
      </div>
    );
  }

  function renderClientRow(c: Client) {
    const isOpen = openForm === c.signupId;
    const busyProv = busyId === `prov-${c.signupId}`;
    const busyStart = busyId === `start-${c.businessId}`;
    const busyConf = busyId === `conf-${c.businessId}`;
    return (
      <div key={`${c.signupId}-${c.businessId}`} style={styles.pipeRow}>
        <div style={styles.pipeHead}>
          <div style={{ minWidth: 0 }}>
            <div style={styles.rowTitle}>{c.businessName}</div>
            <div style={styles.rowSub}>
              {stageLabel(c)}
              {c.billDate ? ` · bill ${fmtDate(c.billDate)}` : ""}
              {c.active === false && c.businessId ? " · ⏸️ OFF" : ""}
            </div>
            <div style={styles.rowSub}>{c.mobile} · {c.email}{c.trade ? ` · ${c.trade}` : ""}</div>
          </div>
          <div style={styles.rowActions}>
            {c.intakeSubmitted && (
              <button style={styles.smallBtn} onClick={() => setOpenForm(isOpen ? null : c.signupId)}>
                {isOpen ? "Hide form" : "View form"}
              </button>
            )}
            {!c.businessId && c.signupId && (
              <button style={styles.provisionBtn} disabled={busyProv} onClick={() => provisionClient(c)}>
                {busyProv ? "Building…" : "⚡ Provision & build"}
              </button>
            )}
            {c.businessId && (c.stage === "built" || c.stage === "trial") && (
              <button style={styles.smallBtn} disabled={busyConf} onClick={() => sendConfirmation(c)}>
                {busyConf ? "Sending…" : "✉️ Send confirmation"}
              </button>
            )}
            {c.businessId && (c.stage === "built" || c.stage === "trial_ended") && (
              <button style={styles.startTrialBtn} disabled={busyStart} onClick={() => startTrial(c)}>
                {busyStart ? "Starting…" : c.stage === "trial_ended" ? "▶ Restart trial" : "▶ Start 14-day trial"}
              </button>
            )}
            {c.businessId && c.stage === "trial" && (
              <>
                <button style={styles.smallBtn} onClick={() => extendTrial(c.businessId!, c.businessName, 7)}>+7 days</button>
                <button style={styles.smallBtn} onClick={() => setActive(c.businessId!, c.businessName, false)}>Turn off</button>
              </>
            )}
            {c.businessId && c.stage === "paying" && (
              <>
                <button style={styles.smallBtn} onClick={() => setActive(c.businessId!, c.businessName, c.active === false)}>
                  {c.active === false ? "Turn on" : "Turn off"}
                </button>
                <button style={styles.smallDangerBtn} onClick={() => cancelSubscription(c)}>Cancel subscription</button>
              </>
            )}
            {c.businessId && c.category !== "cancel_requested" && (
              <button style={styles.smallDangerBtn} onClick={() => removeClient(c)}>Remove</button>
            )}
            {c.signupId && (
              <button style={styles.smallDangerBtn} onClick={() => deleteSignup(c)}>🗑 Delete</button>
            )}
            {c.category === "cancel_requested" && (
              <>
                <button style={styles.startTrialBtn} onClick={() => cancelDecision(c, "keep")}>Keep client</button>
                <button style={styles.smallDangerBtn} onClick={() => cancelDecision(c, "confirm")}>Confirm cancellation</button>
              </>
            )}
          </div>
        </div>
        {isOpen && renderForm(c)}
      </div>
    );
  }

  function renderBucket(title: string, subtitle: string, list: Client[]) {
    return (
      <section style={styles.card}>
        <h2 style={styles.h2}>{title}{list.length > 0 ? ` (${list.length})` : ""}</h2>
        <p style={styles.muted}>{subtitle}</p>
        {list.length === 0 ? <p style={styles.mutedSmall}>None.</p> : list.map(renderClientRow)}
      </section>
    );
  }

  /* ── Main admin ── */
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.h1}>Slimpse</h1>
            <p style={styles.muted}>Client dashboard</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={sendTestEmail} style={styles.ghostBtn} disabled={testingEmail}>
              {testingEmail ? "Sending…" : "✉️ Test email"}
            </button>
            <button onClick={signOut} style={styles.ghostBtn}>Sign out</button>
          </div>
        </header>

        {error && <div style={styles.errorBanner}>{error}</div>}
        {notice && <div style={styles.noticeBanner}>{notice}</div>}

        {/* Tab bar */}
        <div style={styles.tabBar}>
          {[
            { id: "overview", label: "Overview", count: null as number | null },
            { id: "review", label: "📋 Needs review", count: pipeline.filter((c) => c.category === "review").length },
            { id: "trials", label: "🎁 Free trials", count: pipeline.filter((c) => c.category === "trial").length },
            { id: "paying", label: "💳 Paying", count: pipeline.filter((c) => c.category === "paying").length },
            { id: "new", label: "🆕 New", count: pipeline.filter((c) => c.category === "new").length },
            { id: "cancellations", label: "⚠️ Cancellations", count: pipeline.filter((c) => c.category === "cancel_requested").length },
            { id: "businesses", label: "⚙️ Businesses", count: businesses.length },
          ].map((t) => {
            if (t.id === "cancellations" && t.count === 0) return null;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{ ...styles.tab, ...(tab === t.id ? styles.tabActive : {}) }}
              >
                {t.label}{t.count != null ? ` (${t.count})` : ""}
              </button>
            );
          })}
        </div>

        {/* Overview — active businesses + health */}
        {tab === "overview" && (
          <section style={styles.card}>
            <h2 style={styles.h2}>Active businesses{overview.length > 0 ? ` (${overview.length})` : ""}</h2>
            <p style={styles.muted}>Who&apos;s live right now, their call activity, and their health.</p>
            {overview.length === 0 ? (
              <p style={styles.mutedSmall}>No active businesses yet. Start a trial to bring one live.</p>
            ) : (
              overview.map((b) => (
                <div key={b.id} style={styles.row}>
                  <div>
                    <div style={styles.rowTitle}>
                      <span style={healthDot(b.health)} /> {b.businessName}
                    </div>
                    <div style={styles.rowSub}>
                      {b.businessPhone} · {b.callsTotal} calls total · {b.callsWeek} this week
                    </div>
                    <div style={{ ...styles.rowSub, color: healthColor(b.health) }}>{b.reason}</div>
                  </div>
                  <div style={{ ...styles.healthLabel, color: healthColor(b.health) }}>
                    {b.health === "green" ? "Healthy" : b.health === "yellow" ? "Attention" : "Problem"}
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {/* Client pipeline — one bucket per tab */}
        {tab === "cancellations" &&
          renderBucket("⚠️ Cancellation requests", "Clients who asked to cancel — service is already off. Confirm to finalize, or keep them.", pipeline.filter((c) => c.category === "cancel_requested"))}
        {tab === "review" && renderBucket("📋 Needs review", "Forms submitted — review, build their service, then start their trial.", pipeline.filter((c) => c.category === "review"))}
        {tab === "trials" && renderBucket("🎁 On free trial", "Live trials. Bill date = when their 14-day trial ends.", pipeline.filter((c) => c.category === "trial"))}
        {tab === "paying" && renderBucket("💳 Paying", "Active paying clients. Bill date = next charge.", pipeline.filter((c) => c.category === "paying"))}
        {tab === "new" && renderBucket("🆕 New (no form yet)", "Signed up but haven't submitted their setup form.", pipeline.filter((c) => c.category === "new"))}

        {/* Businesses tab: add form + config list */}
        {tab === "businesses" && (
        <>
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
                  <div style={styles.rowTitle}>
                    {b.businessName} <span style={billingBadge(b)}>{billingLabel(b)}</span>
                  </div>
                  <div style={styles.rowSub}>
                    {b.businessPhone} · {b.smsEnabled ? "Text" : "No text"}{b.voiceEnabled ? " + Voice" : ""}
                    {b.active === false ? " · ⏸️ OFF" : ""}
                  </div>
                </div>
                <div style={styles.rowActions}>
                  {b.active === false ? (
                    <button style={styles.smallBtn} onClick={() => setActive(b.id, b.businessName, true)}>Turn on</button>
                  ) : (
                    <button style={styles.smallBtn} onClick={() => setActive(b.id, b.businessName, false)}>Turn off</button>
                  )}
                  <button style={styles.smallBtn} onClick={() => extendTrial(b.id, b.businessName, 7)}>+7 days</button>
                  <button style={styles.smallBtn} onClick={() => startEdit(b)}>Edit</button>
                  <button style={styles.smallDangerBtn} onClick={() => handleDelete(b.id, b.businessName)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>
        </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={styles.stat}>
      <div style={{ ...styles.statValue, ...(accent ? { color: accent } : {}) }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function fmtSecs(s: number | null): string {
  if (s == null) return "—";
  if (s < 60) return `${s}s`;
  return `${Math.round(s / 60)}m`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// A short billing/trial label for a business row.
function billingLabel(b: Business): string {
  const sub = b.subscriptionStatus;
  if (sub === "active" || sub === "trialing") return "PAID";
  if (sub === "past_due") return "PAST DUE";
  if (sub === "canceled") return "CANCELED";
  if (b.trialEndsAt) {
    const days = Math.ceil((new Date(b.trialEndsAt).getTime() - Date.now()) / 86400000);
    return days > 0 ? `TRIAL · ${days}d left` : "TRIAL ENDED";
  }
  return "—";
}
function healthColor(h: "green" | "yellow" | "red"): string {
  return h === "green" ? "#22C55E" : h === "yellow" ? "#F5C518" : "#EF4444";
}
function healthDot(h: "green" | "yellow" | "red"): React.CSSProperties {
  return { display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: healthColor(h), marginRight: 8, verticalAlign: "middle", boxShadow: `0 0 6px ${healthColor(h)}` };
}

function billingBadge(b: Business): React.CSSProperties {
  const l = billingLabel(b);
  const base: React.CSSProperties = { fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 20, marginLeft: 8, verticalAlign: "middle" };
  if (l === "PAID") return { ...base, background: "#0F2A1E", color: "#8FE3B0", border: "1px solid #1F5A3E" };
  if (l === "PAST DUE" || l === "TRIAL ENDED" || l === "CANCELED") return { ...base, background: "#2A1620", color: "#F7A8B8", border: "1px solid #6B2740" };
  return { ...base, background: "#0B1A2E", color: "#9FC2FF", border: "1px solid #24406B" };
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
  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 },
  stat: { background: "#0A0F1E", border: "1px solid #1C2740", borderRadius: 10, padding: "14px 16px" },
  statValue: { fontSize: 24, fontWeight: 800, letterSpacing: -0.5 },
  statLabel: { fontSize: 12.5, color: "#8A93A6", marginTop: 4 },
  revenueTag: { fontSize: 15, fontWeight: 700, color: "#8FE3B0" },
  mutedSmall: { color: "#8A93A6", fontSize: 13 },
  tabBar: { display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 22px" },
  tab: { background: "#0E1526", border: "1px solid #1E2A44", color: "#8A93A6", borderRadius: 10, padding: "9px 15px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  tabActive: { background: "#12264A", border: "1px solid #3B82F6", color: "#fff" },
  healthLabel: { fontSize: 13, fontWeight: 700 },
  pipeRow: { borderTop: "1px solid #16233B", padding: "12px 0" },
  pipeHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" },
  startTrialBtn: { background: "#22C55E", color: "#04220F", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 800, cursor: "pointer" },
  formPanel: { marginTop: 10, background: "#0A0F1E", border: "1px solid #1C2740", borderRadius: 10, padding: "12px 14px" },
  formSectionTitle: { fontSize: 12, fontWeight: 800, color: "#8FB8FF", textTransform: "uppercase", letterSpacing: 0.5, margin: "8px 0 4px" },
  formLine: { fontSize: 13.5, color: "#C7CEDB", lineHeight: 1.5, marginTop: 4, whiteSpace: "pre-wrap" },
  provisionBtn: { background: "#12B886", color: "#04140D", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  pillNew: { background: "#12301F", color: "#8FE3B0", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, marginLeft: 6, verticalAlign: "middle" },
  pillDone: { background: "#1B2740", color: "#9FC2FF", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, marginLeft: 6, verticalAlign: "middle" },
  error: { color: "#F7A8B8", fontSize: 14, marginTop: 12 },
  errorBanner: { background: "#3A1620", color: "#F7A8B8", padding: "10px 14px", borderRadius: 8, fontSize: 14 },
  noticeBanner: { background: "#12301F", color: "#8FE3B0", padding: "10px 14px", borderRadius: 8, fontSize: 14 },
};
