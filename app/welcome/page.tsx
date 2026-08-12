"use client";

import * as React from "react";
import { ONBOARDING_SECTIONS, type OnboardingField } from "@/app/lib/onboardingSchema";
import { VOICE_OPTIONS, DEFAULT_VOICE } from "@/app/lib/voices";

// Public trial status page reached from the welcome email (/welcome?t=<token>).
// Shows what's happening in plain language and lets them cancel — no login.

type Status = "new" | "contacted" | "onboarded" | "cancelled" | "declined" | string;

interface Info {
  businessName: string;
  status: Status;
  phoneNumber: string | null;
  subscriptionStatus?: string | null;
  hasBilling?: boolean;
  billingEnabled?: boolean;
  servicePreference?: string | null;
  exampleMessages?: string | null;
  onboardingDetails?: Record<string, string> | null;
  intakeSubmitted?: boolean;
}

type Service = "" | "voice" | "text" | "both";

export default function WelcomePage() {
  const [token, setToken] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<Info | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [billingBusy, setBillingBusy] = React.useState(false);
  const [justPaid, setJustPaid] = React.useState(false);
  const [service, setService] = React.useState<Service>("");
  const [details, setDetails] = React.useState<Record<string, string>>({});
  const [intakeSubmitted, setIntakeSubmitted] = React.useState(false);
  const [intakeBusy, setIntakeBusy] = React.useState(false);
  const [editingIntake, setEditingIntake] = React.useState(false);
  const [step, setStep] = React.useState(1); // 1 = service, 2 = basics, 3 = optional polish
  const [voiceBusy, setVoiceBusy] = React.useState(false);
  const [playingVoice, setPlayingVoice] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Stop any preview audio when leaving the page.
  React.useEffect(() => () => { audioRef.current?.pause(); }, []);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("t");
    setJustPaid(params.get("paid") === "1");
    if (params.get("cancel") === "1") setConfirmOpen(true);
    setToken(t);
    if (!t) { setLoading(false); setNotFound(true); return; }
    fetch(`/api/onboarding/status?t=${encodeURIComponent(t)}`)
      .then(async (r) => {
        if (!r.ok) { setNotFound(true); return; }
        const data: Info = await r.json();
        setInfo(data);
        if (data.servicePreference) setService(data.servicePreference as Service);
        if (data.onboardingDetails) setDetails(data.onboardingDetails);
        setIntakeSubmitted(Boolean(data.intakeSubmitted));
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, []);

  async function doCancel() {
    if (!token) return;
    setCancelling(true);
    try {
      const r = await fetch("/api/onboarding/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (r.ok) {
        setInfo((prev) => (prev ? { ...prev, status: "cancel_requested" } : prev));
        setConfirmOpen(false);
      }
    } finally {
      setCancelling(false);
    }
  }

  // Chip fields store their picks as a comma-joined string in `details`.
  function chipSelected(fieldId: string, option: string) {
    return (details[fieldId] || "").split(", ").filter(Boolean).includes(option);
  }
  function toggleChip(fieldId: string, option: string) {
    setDetails((d) => {
      const cur = (d[fieldId] || "").split(", ").filter(Boolean);
      const next = cur.includes(option) ? cur.filter((x) => x !== option) : [...cur, option];
      return { ...d, [fieldId]: next.join(", ") };
    });
  }

  // Play a short in-browser demo clip of the given voice; toggles off if it's
  // already the one playing. Falls back gracefully if the clip isn't there yet.
  function previewVoice(v: (typeof VOICE_OPTIONS)[number]) {
    audioRef.current?.pause();
    if (playingVoice === v.id) { setPlayingVoice(null); return; }
    const audio = new Audio(v.file);
    audioRef.current = audio;
    audio.onended = () => setPlayingVoice(null);
    audio.onerror = () => { setPlayingVoice(null); alert("This preview isn't available yet — try \"Call me a sample\" to hear it live."); };
    audio.play().then(() => setPlayingVoice(v.id)).catch(() => setPlayingVoice(null));
  }

  async function testVoice() {
    if (!token) return;
    const voice = details["voiceName"] || DEFAULT_VOICE;
    setVoiceBusy(true);
    try {
      const r = await fetch("/api/onboarding/voice-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, voice }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        alert(j.mock
          ? "Test calls aren't available in this environment yet."
          : "Calling your number now — pick up to hear this voice!");
      } else {
        alert(j.error || "Couldn't place the test call. Please try again.");
      }
    } finally {
      setVoiceBusy(false);
    }
  }

  async function submitIntake() {
    if (!token) return;
    if (!service) { alert("Please choose Text, Voice, or Both."); setStep(1); return; }
    if (!(details["industry"] || "").trim()) { alert("Please tell us your industry."); setStep(2); return; }
    setIntakeBusy(true);
    try {
      const r = await fetch("/api/onboarding/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, service, details }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.success) {
        setIntakeSubmitted(true);
        setEditingIntake(false);
      } else {
        alert(j.error || "Couldn't send your preferences. Please try again.");
      }
    } finally {
      setIntakeBusy(false);
    }
  }

  async function startCheckout() {
    if (!token) return;
    setBillingBusy(true);
    try {
      // The price tier (single vs both) is derived server-side from their service.
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.url) { window.location.href = j.url; return; }
      alert(j.error || "Couldn't start checkout. Please try again.");
    } finally {
      setBillingBusy(false);
    }
  }

  async function openPortal() {
    if (!token) return;
    setBillingBusy(true);
    try {
      const r = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.url) { window.location.href = j.url; return; }
      alert(j.error || "Couldn't open billing. Please try again.");
    } finally {
      setBillingBusy(false);
    }
  }

  const biz = info?.businessName || "your business";

  // Defined before `return` so the render helpers below (which run during the
  // return's JSX evaluation) can read it — a `const` after `return` never
  // initializes and throws a TDZ ReferenceError when accessed.
  const pricingBox = (
    <div style={s.pricingBox}>
      <div style={s.pricingTitle}>14-day free trial</div>
      <ul style={s.pricingList}>
        <li><strong>No card needed</strong> to start</li>
        <li><strong>$59.99/mo</strong> for Voice or Text</li>
        <li><strong>$100/mo</strong> for both Voice + Text</li>
        <li>Cancel anytime</li>
      </ul>
    </div>
  );

  return (
    <main style={s.wrap}>
      <div style={s.card}>
        {loading ? (
          <p style={s.muted}>Loading your trial…</p>
        ) : notFound || !info ? (
          <>
            <div style={s.kicker}>◆ MissedCall</div>
            <h1 style={s.h1}>We couldn&apos;t find that trial</h1>
            <p style={s.sub}>This link may be old or incomplete. If you think this is a mistake,
              just reply to your welcome email and we&apos;ll sort it out.</p>
          </>
        ) : info.status === "cancelled" || info.status === "cancel_requested" ? (
          <>
            <div style={s.kicker}>◆ MissedCall</div>
            <h1 style={s.h1}>
              {info.status === "cancel_requested" ? "Cancellation received" : "Your trial is cancelled"}
            </h1>
            <p style={s.sub}>No charges, nothing else to do — we&apos;ve stopped your setup for
              {" "}{biz}. Changed your mind? Reply to your welcome email and we&apos;ll turn it right
              back on.</p>
          </>
        ) : info.status === "onboarded" ? (
          <>
            <div style={s.kicker}>◆ MissedCall · You&apos;re live</div>
            <h1 style={s.h1}>{biz} is ready to go</h1>
            {info.phoneNumber && (
              <div style={s.numberBox}>
                <div style={s.numberLabel}>Your dedicated number</div>
                <div style={s.number}>{info.phoneNumber}</div>
              </div>
            )}
            <p style={s.sub}>One 2-minute step and every missed call gets an instant text-back:</p>
            <ul style={s.steps}>
              <li style={s.step}><strong>Forward when unanswered:</strong> dial <code style={s.code}>*71</code> then your new number</li>
              <li style={s.step}><strong>When busy:</strong> <code style={s.code}>*90</code> · <strong>when unreachable:</strong> <code style={s.code}>*92</code></li>
              <li style={s.step}>On a VoIP/office phone it&apos;s a settings toggle — reply to your email and we&apos;ll help.</li>
            </ul>
            {renderConversion()}
            {renderCancel()}
          </>
        ) : (
          <>
            <div style={s.kicker}>◆ MissedCall</div>
            <h1 style={s.h1}>We&apos;re setting up {biz}</h1>
            <p style={s.sub}>Everything&apos;s on track — here&apos;s exactly where things stand, so
              nothing catches you off guard.</p>

            <ol style={s.timeline}>
              <li style={{ ...s.tItem, ...s.tDone }}><span style={s.tMark}>✓</span> You signed up — done</li>
              <li style={{ ...s.tItem, ...s.tActive }}><span style={s.tMarkActive}>●</span> We&apos;re building your number &amp; text-back <em style={s.now}>(now)</em></li>
              <li style={s.tItem}>
                <span style={s.tMarkPending}>○</span>
                <span>Confirmation — we email you your number + the 2-minute forwarding step
                  <span style={s.timeNote}>(24–72 hours)</span>
                </span>
              </li>
              <li style={s.tItem}><span style={s.tMarkPending}>○</span> You&apos;re live — missed calls turn into texts</li>
            </ol>

            <p style={s.reassure}>Finish your quick setup below so we can build your text-back exactly how you want it.</p>
            {renderConversion()}
            {renderCancel()}
          </>
        )}
      </div>
    </main>
  );

  // Once someone is (or just became) a paying customer, show billing status
  // instead of the setup form; otherwise show the two-step setup form.
  function renderConversion() {
    const sub = info?.subscriptionStatus;
    if (justPaid || sub === "active" || sub === "trialing") {
      return (
        <div style={s.billingActive}>
          <span>✅ Your service is active — thank you!</span>
          {info?.billingEnabled && (
            <button style={s.manageLink} onClick={openPortal} disabled={billingBusy}>Manage billing</button>
          )}
        </div>
      );
    }
    if (sub === "past_due") {
      return (
        <div style={s.billingWarn}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ There was a problem with your payment</div>
          <p style={{ margin: "0 0 10px", fontSize: 14, color: "#E9C9A0" }}>Update your card to keep your service running.</p>
          <button style={s.payBtn} onClick={openPortal} disabled={billingBusy}>
            {billingBusy ? "Opening…" : "Update payment"}
          </button>
        </div>
      );
    }
    return renderSetup();
  }

  // The setup form — a short 3-step wizard. Step 1 (service) and step 2
  // (business basics) are required; step 3 (polish) is optional and skippable.
  function renderSetup() {
    const services: { key: Service; label: string; hint: string }[] = [
      { key: "text", label: "Text", hint: "Auto text-back on missed calls" },
      { key: "voice", label: "Voice", hint: "Voicemail / voice menu" },
      { key: "both", label: "Both", hint: "Text-back + voice" },
    ];
    const showForm = !intakeSubmitted || editingIntake;

    // Already submitted → confirmation + optional pay-now.
    if (!showForm) {
      return (
        <div style={s.setupBox}>
          <div style={s.intakeDone}>
            <div style={{ fontWeight: 700, color: "#8FE3B0", marginBottom: 6 }}>✓ Answers sent — we&apos;re on it!</div>
            <div style={s.intakeSummary}>
              <strong>Service:</strong>{" "}
              {service === "both" ? "Voice + Text" : service === "voice" ? "Voice" : "Text"}
            </div>
            <div style={s.intakeSummary}>
              No card needed right now. We&apos;re building your custom setup and will email you to
              confirm it looks good. Once you approve, we&apos;ll start your 14-day free trial.
            </div>
            <button style={s.editLink} onClick={() => { setEditingIntake(true); setStep(1); }}>Edit my answers</button>
          </div>
          {pricingBox}
          {info?.billingEnabled && (
            <>
              <button style={s.payBtn} onClick={startCheckout} disabled={billingBusy}>
                {billingBusy ? "Loading…" : `Add payment — ${service === "both" ? "$100" : "$59.99"}/mo`}
              </button>
              <p style={s.payNote}>Ready to go live now, or keeping your service after the trial? Add your card here — cancel anytime.</p>
            </>
          )}
        </div>
      );
    }

    const basics = ONBOARDING_SECTIONS[0];
    const polish = ONBOARDING_SECTIONS[1];
    const industryFilled = Boolean((details["industry"] || "").trim());
    const steps = ["Service", basics.stepLabel, polish.stepLabel];

    return (
      <div style={s.setupBox}>
        {/* Payoff up front */}
        <div style={s.trialBanner}>14-day free trial · <strong>No card needed</strong> · Cancel anytime</div>

        {/* Progress bar */}
        <div style={s.progressWrap}>
          {steps.map((label, i) => {
            const n = i + 1;
            const state = n < step ? "done" : n === step ? "on" : "todo";
            return (
              <div key={label} style={s.progressItem}>
                <div style={{ ...s.progressDot, ...(state === "on" ? s.progressDotOn : state === "done" ? s.progressDotDone : {}) }}>
                  {state === "done" ? "✓" : n}
                </div>
                <span style={{ ...s.progressLabel, ...(state === "on" ? s.progressLabelOn : {}) }}>{label}</span>
              </div>
            );
          })}
        </div>

        {step === 1 && (
          <>
            <label style={s.fieldLabel}>Which service do you want? <span style={s.req}>*required</span></label>
            <div style={s.svcRow}>
              {services.map((o) => (
                <button key={o.key} onClick={() => setService(o.key)}
                  style={{ ...s.svcBtn, ...(service === o.key ? s.svcBtnOn : {}) }}>
                  <span style={s.svcLabel}>{o.label}</span>
                  <span style={s.svcHint}>{o.hint}</span>
                </button>
              ))}
            </div>
            <div style={s.navRow}>
              <span />
              <button style={{ ...s.nextBtn, ...(service ? {} : s.nextBtnOff) }} disabled={!service} onClick={() => setStep(2)}>
                Continue →
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={s.sectionTitle}>{basics.title}</div>
            {basics.fields.map((f) => renderField(f))}
            <div style={s.navRow}>
              <button style={s.backBtn} onClick={() => setStep(1)}>← Back</button>
              <button style={{ ...s.nextBtn, ...(industryFilled ? {} : s.nextBtnOff) }} disabled={!industryFilled} onClick={() => setStep(3)}>
                Continue →
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div style={s.sectionTitle}>{polish.title}</div>
            <p style={s.optionalNote}>The more you share, the better.</p>
            {(service === "voice" || service === "both") && (
              <div style={{ marginBottom: 16 }}>
                <label style={s.fieldLabel}>Pick your call voice</label>
                <p style={s.optionalNote}>Tap Preview to hear each one, then pick your favorite.</p>
                <div style={s.voiceList}>
                  {VOICE_OPTIONS.map((v) => {
                    const selected = (details["voiceName"] || DEFAULT_VOICE) === v.id;
                    return (
                      <div key={v.id} style={{ ...s.voiceRow, ...(selected ? s.voiceRowOn : {}) }}>
                        <button type="button" style={s.voicePlay} onClick={() => previewVoice(v)}>
                          {playingVoice === v.id ? "Stop" : "Preview"}
                        </button>
                        <button type="button" style={s.voiceSelect} onClick={() => setDetails((d) => ({ ...d, voiceName: v.id }))}>
                          {v.label}
                        </button>
                        {selected && <span style={s.voiceChosen}>Selected</span>}
                      </div>
                    );
                  })}
                </div>
                <button style={s.callLink} onClick={testVoice} disabled={voiceBusy}>
                  {voiceBusy ? "Calling…" : "Prefer a live call? Call me a sample"}
                </button>
              </div>
            )}
            {polish.fields.map((f) => renderField(f))}
            <div style={s.navRow}>
              <button style={s.backBtn} onClick={() => setStep(2)}>← Back</button>
              <button style={s.nextBtn} onClick={submitIntake} disabled={intakeBusy}>
                {intakeBusy ? "Sending…" : intakeSubmitted ? "Update my answers" : "Finish setup"}
              </button>
            </div>
            <button style={s.skipLink} onClick={submitIntake} disabled={intakeBusy}>
              Skip these — finish later
            </button>
          </>
        )}
      </div>
    );
  }

  // Renders one schema field by its type (text / textarea / radio / chips).
  function renderField(f: OnboardingField) {
    return (
      <div key={f.id} style={{ marginBottom: 14 }}>
        <label style={s.fieldLabel}>
          {f.label} {f.required ? <span style={s.req}>*required</span> : null}
        </label>
        {f.type === "textarea" ? (
          <textarea
            value={details[f.id] || ""}
            onChange={(e) => setDetails((d) => ({ ...d, [f.id]: e.target.value }))}
            placeholder={f.placeholder}
            style={s.textarea}
            rows={3}
          />
        ) : f.type === "radio" ? (
          <div style={s.radioRow}>
            {f.options!.map((opt) => (
              <button key={opt} type="button" onClick={() => setDetails((d) => ({ ...d, [f.id]: opt }))}
                style={{ ...s.radioBtn, ...(details[f.id] === opt ? s.radioBtnOn : {}) }}>
                {opt}
              </button>
            ))}
          </div>
        ) : f.type === "chips" ? (
          <div style={s.radioRow}>
            {f.options!.map((opt) => (
              <button key={opt} type="button" onClick={() => toggleChip(f.id, opt)}
                style={{ ...s.chip, ...(chipSelected(f.id, opt) ? s.chipOn : {}) }}>
                {chipSelected(f.id, opt) ? "✓ " : ""}{opt}
              </button>
            ))}
          </div>
        ) : (
          <input type="text" value={details[f.id] || ""}
            onChange={(e) => setDetails((d) => ({ ...d, [f.id]: e.target.value }))}
            placeholder={f.placeholder} style={s.input} />
        )}
      </div>
    );
  }

  function renderCancel() {
    return (
      <div style={s.cancelZone}>
        {!confirmOpen ? (
          <button style={s.cancelLink} onClick={() => setConfirmOpen(true)}>Cancel my free trial</button>
        ) : (
          <div style={s.confirmBox}>
            <p style={s.confirmText}>Cancel the trial for {biz}? No charge — you can always start again.</p>
            <div style={s.confirmRow}>
              <button style={s.confirmYes} onClick={doCancel} disabled={cancelling}>
                {cancelling ? "Cancelling…" : "Yes, cancel"}
              </button>
              <button style={s.confirmNo} onClick={() => setConfirmOpen(false)} disabled={cancelling}>
                Keep my trial
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", background: "#070B15", color: "#E5E9F0", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "system-ui, -apple-system, sans-serif" },
  card: { width: "100%", maxWidth: 500, background: "#0E1526", border: "1px solid #1E2A44", borderRadius: 16, padding: 28 },
  kicker: { fontSize: 13, fontWeight: 800, color: "#34D399", letterSpacing: 0.4 },
  h1: { fontSize: 27, fontWeight: 800, margin: "8px 0 10px", lineHeight: 1.15 },
  sub: { fontSize: 15.5, lineHeight: 1.6, color: "#98A2B6", margin: "0 0 18px" },
  muted: { color: "#8A93A6", fontSize: 15 },
  numberBox: { background: "#0A1F16", border: "1px solid #1F5A3E", borderRadius: 12, padding: "14px 16px", margin: "4px 0 18px" },
  numberLabel: { fontSize: 12.5, color: "#7FBFA0", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 },
  number: { fontSize: 24, fontWeight: 800, color: "#B8F0CF", marginTop: 4 },
  steps: { listStyle: "none", padding: 0, margin: "0 0 8px", display: "flex", flexDirection: "column", gap: 10 },
  step: { background: "#0A0F1E", border: "1px solid #1C2740", borderRadius: 10, padding: "12px 14px", fontSize: 14, lineHeight: 1.5, color: "#C7CEDB" },
  code: { background: "#1B2740", color: "#9FC2FF", padding: "1px 6px", borderRadius: 5, fontSize: 13 },
  timeline: { listStyle: "none", padding: 0, margin: "0 0 18px", display: "flex", flexDirection: "column", gap: 14 },
  tItem: { display: "flex", alignItems: "flex-start", gap: 10, fontSize: 16.5, color: "#7A8397", lineHeight: 1.45 },
  timeNote: { display: "block", fontSize: 13.5, color: "#7A8397", fontStyle: "normal", marginTop: 2 },
  tDone: { color: "#8FE3B0" },
  tActive: { color: "#E5E9F0", fontWeight: 600 },
  tMark: { color: "#34D399", fontWeight: 800, width: 18, textAlign: "center" },
  tMarkActive: { color: "#3B82F6", fontWeight: 800, width: 18, textAlign: "center" },
  tMarkPending: { color: "#3A465E", width: 18, textAlign: "center" },
  now: { color: "#3B82F6", fontStyle: "normal", fontSize: 13, fontWeight: 700 },
  reassure: { background: "#0F1A2E", border: "1px solid #24324F", borderRadius: 10, padding: "12px 14px", fontSize: 14, lineHeight: 1.55, color: "#B8C0D0", margin: "0 0 6px" },
  setupBox: { marginTop: 20, background: "#0B1A2E", border: "1px solid #24406B", borderRadius: 12, padding: "18px" },
  trialBanner: { background: "#0A1F16", border: "1px solid #1F5A3E", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#B8F0CF", textAlign: "center", marginBottom: 16 },
  progressWrap: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 18 },
  progressItem: { display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 },
  progressDot: { width: 24, height: 24, borderRadius: "50%", background: "#0A0F1E", border: "1px solid #2A3854", color: "#7A8397", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  progressDotOn: { background: "#12264A", border: "1px solid #3B82F6", color: "#fff", boxShadow: "0 0 0 1px #3B82F6" },
  progressDotDone: { background: "#0F2A1E", border: "1px solid #1F5A3E", color: "#8FE3B0" },
  progressLabel: { fontSize: 12, color: "#7A8397", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  progressLabelOn: { color: "#E5E9F0" },
  navRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 18 },
  backBtn: { background: "transparent", color: "#98A2B6", border: "1px solid #2A3854", borderRadius: 10, padding: "11px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  nextBtn: { background: "#3B82F6", color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  nextBtnOff: { background: "#1B2740", color: "#5A6478", cursor: "not-allowed" },
  chip: { background: "#0A0F1E", border: "1px solid #22304C", borderRadius: 20, padding: "8px 14px", cursor: "pointer", color: "#C7CEDB", fontSize: 13.5 },
  chipOn: { border: "1px solid #34D399", background: "#0F2A1E", color: "#B8F0CF" },
  skipLink: { display: "block", width: "100%", background: "transparent", color: "#7A8397", border: "none", fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0, marginTop: 14, textAlign: "center" },
  voiceList: { display: "flex", flexDirection: "column", gap: 8 },
  voiceRow: { display: "flex", alignItems: "center", gap: 10, background: "#0A0F1E", border: "1px solid #22304C", borderRadius: 10, padding: "8px 10px" },
  voiceRowOn: { border: "1px solid #3B82F6", background: "#12264A", boxShadow: "0 0 0 1px #3B82F6" },
  voicePlay: { background: "#1B2740", color: "#9FC2FF", border: "1px solid #2A3854", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", minWidth: 78 },
  voiceSelect: { flex: 1, textAlign: "left", background: "transparent", color: "#E5E9F0", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", padding: 0 },
  voiceChosen: { fontSize: 11.5, fontWeight: 700, color: "#8FE3B0", flexShrink: 0 },
  callLink: { display: "block", width: "100%", background: "transparent", color: "#8FB8FF", border: "none", fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0, marginTop: 12, textAlign: "center" },
  howHead: { fontSize: 15.5, fontWeight: 700, marginBottom: 8 },
  howList: { margin: "0 0 18px", paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: "#C7CEDB" },
  pricingBox: { margin: "16px 0", background: "#0A1F16", border: "1px solid #1F5A3E", borderRadius: 10, padding: "14px 16px" },
  pricingTitle: { fontSize: 15, fontWeight: 800, color: "#B8F0CF", marginBottom: 6 },
  pricingList: { margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: "#C7CEDB" },
  stepHead: { fontSize: 15.5, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 },
  stepBadge: { fontSize: 11, fontWeight: 800, background: "#1B3B66", color: "#9FC2FF", padding: "3px 8px", borderRadius: 20, letterSpacing: 0.3 },
  svcRow: { display: "flex", gap: 8, marginBottom: 14 },
  svcBtn: { flex: 1, background: "#0A0F1E", border: "1px solid #22304C", borderRadius: 10, padding: "10px 6px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: "#C7CEDB" },
  svcBtnOn: { border: "1px solid #3B82F6", background: "#12264A", color: "#fff", boxShadow: "0 0 0 1px #3B82F6" },
  svcLabel: { fontSize: 14, fontWeight: 700 },
  svcHint: { fontSize: 10.5, color: "#8A93A6", textAlign: "center", lineHeight: 1.3 },
  fieldLabel: { display: "block", fontSize: 13, color: "#98A2B6", marginBottom: 6, fontWeight: 600 },
  req: { color: "#F7A8B8", fontWeight: 600, fontSize: 11.5 },
  optionalNote: { fontSize: 12.5, color: "#7A8397", lineHeight: 1.5, margin: "4px 0 16px", background: "#0A0F1E", border: "1px solid #1C2740", borderRadius: 8, padding: "10px 12px" },
  formSection: { marginBottom: 8, paddingTop: 12, borderTop: "1px solid #16233B" },
  sectionTitle: { fontSize: 13, fontWeight: 800, color: "#8FB8FF", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  input: { width: "100%", background: "#0A0F1E", border: "1px solid #22304C", borderRadius: 10, padding: "10px 12px", color: "#E5E9F0", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" },
  radioRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  radioBtn: { background: "#0A0F1E", border: "1px solid #22304C", borderRadius: 8, padding: "8px 14px", cursor: "pointer", color: "#C7CEDB", fontSize: 13.5 },
  radioBtnOn: { border: "1px solid #3B82F6", background: "#12264A", color: "#fff" },
  textarea: { width: "100%", background: "#0A0F1E", border: "1px solid #22304C", borderRadius: 10, padding: "10px 12px", color: "#E5E9F0", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" },
  startBtn: { background: "#22C55E", color: "#04220F", border: "none", borderRadius: 10, padding: "13px 18px", fontSize: 15, fontWeight: 800, cursor: "pointer", width: "100%" },
  stepLocked: { fontSize: 13.5, color: "#7A8397", margin: 0, background: "#0A0F1E", border: "1px dashed #2A3854", borderRadius: 10, padding: "12px 14px" },
  intakeDone: { background: "#0A1F16", border: "1px solid #1F5A3E", borderRadius: 10, padding: "12px 14px" },
  intakeSummary: { fontSize: 13.5, color: "#C7CEDB", marginTop: 4, lineHeight: 1.5 },
  editLink: { background: "transparent", color: "#8FB8FF", border: "none", fontSize: 12.5, cursor: "pointer", textDecoration: "underline", padding: 0, marginTop: 8 },
  billingBox: { marginTop: 20, background: "#0B1A2E", border: "1px solid #24406B", borderRadius: 12, padding: "16px 18px" },
  billingTitle: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  billingSub: { fontSize: 14, lineHeight: 1.55, color: "#98A2B6", margin: "0 0 14px" },
  payBtn: { background: "#3B82F6", color: "#fff", border: "none", borderRadius: 10, padding: "12px 18px", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 12 },
  payNote: { fontSize: 12.5, color: "#7A8397", lineHeight: 1.5, margin: "8px 0 0", textAlign: "center" },
  annualLink: { background: "transparent", color: "#8FB8FF", border: "none", fontSize: 13.5, cursor: "pointer", marginTop: 10, textDecoration: "underline", padding: 0, display: "block", width: "100%" },
  billingActive: { marginTop: 20, background: "#0F2A1E", border: "1px solid #1F5A3E", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#B8F0CF", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  billingWarn: { marginTop: 20, background: "#2A1E0F", border: "1px solid #6B4A1F", borderRadius: 10, padding: "14px 16px" },
  manageLink: { background: "transparent", color: "#8FE3B0", border: "1px solid #1F5A3E", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer", fontWeight: 600 },
  cancelZone: { marginTop: 22, paddingTop: 18, borderTop: "1px solid #1A2338" },
  cancelLink: { background: "transparent", color: "#7A8397", border: "none", fontSize: 13.5, cursor: "pointer", textDecoration: "underline", padding: 0 },
  confirmBox: { background: "#12131C", border: "1px solid #2A2030", borderRadius: 10, padding: 14 },
  confirmText: { fontSize: 14, color: "#D8C4CC", margin: "0 0 12px", lineHeight: 1.5 },
  confirmRow: { display: "flex", gap: 10 },
  confirmYes: { background: "#3A1620", color: "#F7A8B8", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  confirmNo: { background: "#1B2740", color: "#E5E9F0", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
};
