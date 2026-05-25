"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface Answers {
  role: string;
  industry: string;
  brandDescription: string;
  idealCustomer: string;
  leadSources: string[];
  biggestChallenge: string;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

const ROLES = [
  { value: "founder", label: "Founder / CEO", icon: "🚀" },
  { value: "sales", label: "Sales Rep / AE", icon: "💼" },
  { value: "marketing", label: "Marketing Manager", icon: "📣" },
  { value: "bdr", label: "BDR / SDR", icon: "📞" },
  { value: "revops", label: "RevOps / Operations", icon: "⚙️" },
  { value: "other", label: "Other", icon: "👤" },
];

const INDUSTRIES = [
  { value: "saas", label: "SaaS / Tech", icon: "💻" },
  { value: "agency", label: "Agency / Consulting", icon: "🎨" },
  { value: "realestate", label: "Real Estate", icon: "🏠" },
  { value: "finance", label: "Finance / Fintech", icon: "💰" },
  { value: "healthcare", label: "Healthcare", icon: "🏥" },
  { value: "ecommerce", label: "E-commerce / Retail", icon: "🛍️" },
  { value: "manufacturing", label: "Manufacturing", icon: "🏭" },
  { value: "other", label: "Other", icon: "🌐" },
];

const LEAD_SOURCES = [
  "Cold outreach",
  "LinkedIn",
  "Referrals",
  "Inbound / SEO",
  "Events & Conferences",
  "Paid Ads",
  "Partnerships",
  "Social media",
];

const CHALLENGES = [
  { value: "volume", label: "Not enough leads", icon: "📉" },
  { value: "quality", label: "Lead quality is low", icon: "🎯" },
  { value: "followup", label: "Following up consistently", icon: "🔄" },
  { value: "visibility", label: "Pipeline visibility", icon: "👁️" },
  { value: "team", label: "Team collaboration", icon: "🤝" },
  { value: "time", label: "Not enough time", icon: "⏰" },
];

/* ─── Industry pipeline stage presets ───────────────────────────────────── */

const PIPELINE_PRESETS: Record<string, { key: string; label: string; color: string; position: number }[]> = {
  realestate: [
    { key: "prospect", label: "Prospect", color: "gray", position: 0 },
    { key: "showing", label: "Showing", color: "blue", position: 1 },
    { key: "offer", label: "Offer Made", color: "amber", position: 2 },
    { key: "under_contract", label: "Under Contract", color: "orange", position: 3 },
    { key: "closed", label: "Closed", color: "emerald", position: 4 },
  ],
  agency: [
    { key: "lead", label: "Lead", color: "gray", position: 0 },
    { key: "discovery", label: "Discovery", color: "blue", position: 1 },
    { key: "proposal", label: "Proposal", color: "cyan", position: 2 },
    { key: "negotiation", label: "Negotiation", color: "amber", position: 3 },
    { key: "won", label: "Won", color: "emerald", position: 4 },
  ],
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

async function applyPipelinePreset(industry: string) {
  const preset = PIPELINE_PRESETS[industry];
  if (!preset) return; // default stages already exist

  try {
    // Clear existing custom stages first
    await fetch("/api/pipeline-stages", { method: "DELETE" });
    // Insert each stage
    for (const stage of preset) {
      await fetch("/api/pipeline-stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stage),
      });
    }
  } catch {
    // Non-fatal — user can customise later
  }
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function OptionCard({
  selected,
  onClick,
  icon,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 text-left transition-all duration-150 ${
        selected
          ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750"
      }`}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
      {selected && (
        <span className="ml-auto text-brand-500">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      )}
    </button>
  );
}

function CheckboxChip({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 rounded-full border-2 text-sm font-medium transition-all duration-150 ${
        selected
          ? "border-brand-500 bg-brand-500 text-white"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-brand-300 dark:hover:border-brand-700"
      }`}
    >
      {selected && <span className="mr-1.5">✓</span>}
      {label}
    </button>
  );
}

/* ─── Left panel ─────────────────────────────────────────────────────────── */

function LeftPanel({ step, total }: { step: number; total: number }) {
  const features = [
    { icon: "🎯", text: "AI-powered lead scoring" },
    { icon: "📊", text: "Visual pipeline management" },
    { icon: "🤝", text: "Team collaboration tools" },
    { icon: "📈", text: "Revenue forecasting" },
    { icon: "🔔", text: "Smart follow-up reminders" },
  ];

  return (
    <div className="hidden lg:flex flex-col justify-between w-2/5 bg-gray-900 dark:bg-gray-950 px-10 py-12 text-white">
      {/* Logo */}
      <div>
        <div className="flex items-center gap-2 mb-12">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold text-sm">
            L
          </div>
          <span className="text-lg font-bold">LeadIQ</span>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2 text-xs text-gray-400">
            <span>Setup progress</span>
            <span>{step} of {total}</span>
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(step / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Steps list */}
        <div className="space-y-3">
          {[
            "Your role",
            "Industry",
            "About your brand",
            "Ideal customer",
            "Lead sources",
            "Your challenge",
          ].map((label, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 text-sm transition-all duration-300 ${
                i + 1 < step
                  ? "text-brand-400"
                  : i + 1 === step
                  ? "text-white font-medium"
                  : "text-gray-600"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 border transition-all duration-300 ${
                  i + 1 < step
                    ? "bg-brand-500 border-brand-500 text-white"
                    : i + 1 === step
                    ? "border-white text-white"
                    : "border-gray-700 text-gray-600"
                }`}
              >
                {i + 1 < step ? (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Features callout */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-4 font-semibold">
          What you&apos;re unlocking
        </p>
        <div className="space-y-3">
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-2.5 text-sm text-gray-400">
              <span>{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Completion screen ──────────────────────────────────────────────────── */

function CompletionScreen({ answers, onDone }: { answers: Answers; onDone: () => void }) {
  const [visible, setVisible] = useState(false);
  const [cardsVisible, setCardsVisible] = useState<boolean[]>([false, false, false, false]);

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
    [0, 1, 2, 3].forEach((i) => {
      setTimeout(() => {
        setCardsVisible((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, 600 + i * 150);
    });
  }, []);

  const industryLabel = INDUSTRIES.find((i) => i.value === answers.industry)?.label ?? answers.industry;
  const roleLabel = ROLES.find((r) => r.value === answers.role)?.label ?? answers.role;
  const challengeLabel = CHALLENGES.find((c) => c.value === answers.biggestChallenge)?.label ?? answers.biggestChallenge;

  const summaryCards = [
    { label: "Your role", value: roleLabel, icon: "👤" },
    { label: "Industry", value: industryLabel, icon: "🏢" },
    { label: "Lead sources", value: answers.leadSources.slice(0, 3).join(", ") || "—", icon: "🎯" },
    { label: "Focus area", value: challengeLabel || "—", icon: "🚀" },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 bg-white dark:bg-gray-900">
      <div
        className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
      >
        {/* Animated checkmark */}
        <div className="flex justify-center mb-8">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full bg-emerald-100 dark:bg-emerald-900/30 animate-ping opacity-30" />
            <div className="relative w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                  className="animate-[dash_0.6s_ease-out_0.2s_forwards]"
                  style={{
                    strokeDasharray: 30,
                    strokeDashoffset: visible ? 0 : 30,
                    transition: "stroke-dashoffset 0.5s ease-out 0.3s",
                  }}
                />
              </svg>
            </div>
          </div>
        </div>

        <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-2">
          You&apos;re all set! 🎉
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center mb-10 max-w-sm">
          LeadIQ is personalised to your workflow. Here&apos;s a summary of your setup:
        </p>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 mb-10 w-full max-w-md">
          {summaryCards.map((card, i) => (
            <div
              key={i}
              className={`bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 transition-all duration-500 ${
                cardsVisible[i] ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
              }`}
            >
              <div className="text-2xl mb-2">{card.icon}</div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide mb-0.5">
                {card.label}
              </p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {card.value}
              </p>
            </div>
          ))}
        </div>

        <button
          onClick={onDone}
          className="w-full max-w-md py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-2xl transition-colors shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 text-sm"
        >
          Open my dashboard
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */

const TOTAL_STEPS = 6;

export default function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);
  const [complete, setComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [answers, setAnswers] = useState<Answers>({
    role: "",
    industry: "",
    brandDescription: "",
    idealCustomer: "",
    leadSources: [],
    biggestChallenge: "",
  });

  // Check if already onboarded
  useEffect(() => {
    if (typeof window !== "undefined") {
      const done = localStorage.getItem("leadflow_onboarding_complete");
      if (done === "1") {
        router.replace("/dashboard");
      }
    }
  }, [router]);

  function canContinue() {
    switch (step) {
      case 1: return answers.role !== "";
      case 2: return answers.industry !== "";
      case 3: return answers.brandDescription.trim().length > 0;
      case 4: return answers.idealCustomer.trim().length > 0;
      case 5: return answers.leadSources.length > 0;
      case 6: return answers.biggestChallenge !== "";
      default: return false;
    }
  }

  function navigate(newStep: number, dir: "forward" | "back") {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setStep(newStep);
      setAnimating(false);
    }, 250);
  }

  async function handleComplete() {
    if (submitting) return;
    setSubmitting(true);
    try {
      localStorage.setItem("leadflow_onboarding_data", JSON.stringify(answers));
      localStorage.setItem("leadflow_onboarding_complete", "1");
      await applyPipelinePreset(answers.industry);
    } catch {
      // Non-fatal
    }
    setComplete(true);
    setSubmitting(false);
  }

  function handleDone() {
    router.push("/dashboard");
  }

  function toggleLeadSource(source: string) {
    setAnswers((prev) => ({
      ...prev,
      leadSources: prev.leadSources.includes(source)
        ? prev.leadSources.filter((s) => s !== source)
        : [...prev.leadSources, source],
    }));
  }

  /* Animation classes */
  const slideClass = animating
    ? direction === "forward"
      ? "opacity-0 -translate-x-6"
      : "opacity-0 translate-x-6"
    : "opacity-100 translate-x-0";

  /* ── If complete, show completion screen ── */
  if (complete) {
    return (
      <div className="flex min-h-screen">
        <LeftPanel step={TOTAL_STEPS} total={TOTAL_STEPS} />
        <CompletionScreen answers={answers} onDone={handleDone} />
      </div>
    );
  }

  /* ── Question screens ── */
  function renderStep() {
    switch (step) {
      case 1:
        return (
          <div className={`space-y-3 transition-all duration-250 ${slideClass}`}>
            {ROLES.map((r) => (
              <OptionCard
                key={r.value}
                selected={answers.role === r.value}
                onClick={() => setAnswers((p) => ({ ...p, role: r.value }))}
                icon={r.icon}
                label={r.label}
              />
            ))}
          </div>
        );

      case 2:
        return (
          <div className={`grid grid-cols-2 gap-3 transition-all duration-250 ${slideClass}`}>
            {INDUSTRIES.map((ind) => (
              <OptionCard
                key={ind.value}
                selected={answers.industry === ind.value}
                onClick={() => setAnswers((p) => ({ ...p, industry: ind.value }))}
                icon={ind.icon}
                label={ind.label}
              />
            ))}
          </div>
        );

      case 3:
        return (
          <div className={`space-y-4 transition-all duration-250 ${slideClass}`}>
            <textarea
              rows={4}
              value={answers.brandDescription}
              onChange={(e) => setAnswers((p) => ({ ...p, brandDescription: e.target.value }))}
              placeholder="e.g. We help mid-market SaaS companies reduce churn by improving onboarding..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition resize-none"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500">
              This helps personalise your pipeline and follow-up suggestions.
            </p>
          </div>
        );

      case 4:
        return (
          <div className={`space-y-4 transition-all duration-250 ${slideClass}`}>
            <textarea
              rows={4}
              value={answers.idealCustomer}
              onChange={(e) => setAnswers((p) => ({ ...p, idealCustomer: e.target.value }))}
              placeholder="e.g. VP of Sales at B2B SaaS companies with 50–500 employees, Series A–C, using Salesforce..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition resize-none"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Knowing your ICP helps us score and prioritise leads better.
            </p>
          </div>
        );

      case 5:
        return (
          <div className={`transition-all duration-250 ${slideClass}`}>
            <div className="flex flex-wrap gap-2.5">
              {LEAD_SOURCES.map((source) => (
                <CheckboxChip
                  key={source}
                  selected={answers.leadSources.includes(source)}
                  onClick={() => toggleLeadSource(source)}
                  label={source}
                />
              ))}
            </div>
            {answers.leadSources.length > 0 && (
              <p className="mt-4 text-xs text-brand-600 dark:text-brand-400">
                {answers.leadSources.length} source{answers.leadSources.length > 1 ? "s" : ""} selected
              </p>
            )}
          </div>
        );

      case 6:
        return (
          <div className={`space-y-3 transition-all duration-250 ${slideClass}`}>
            {CHALLENGES.map((c) => (
              <OptionCard
                key={c.value}
                selected={answers.biggestChallenge === c.value}
                onClick={() => setAnswers((p) => ({ ...p, biggestChallenge: c.value }))}
                icon={c.icon}
                label={c.label}
              />
            ))}
          </div>
        );

      default:
        return null;
    }
  }

  const STEP_HEADINGS = [
    { title: "What's your role?", subtitle: "This helps us tailor your experience from day one." },
    { title: "What industry are you in?", subtitle: "We'll customise your pipeline stages to match." },
    { title: "Describe your business", subtitle: "A quick sentence about what you sell and who you sell it to." },
    { title: "Who is your ideal customer?", subtitle: "Paint a picture of your best-fit prospect." },
    { title: "Where do your leads come from?", subtitle: "Select all that apply — pick as many as you like." },
    { title: "What's your biggest challenge?", subtitle: "We'll highlight the features that solve this first." },
  ];

  const heading = STEP_HEADINGS[step - 1];

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <LeftPanel step={step} total={TOTAL_STEPS} />

      {/* Right panel */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 overflow-y-auto">
        {/* Mobile progress bar */}
        <div className="lg:hidden h-1 bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full bg-brand-500 transition-all duration-500"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 py-12 max-w-lg mx-auto w-full">
          {/* Mobile step counter */}
          <div className="lg:hidden mb-6 flex items-center gap-2 text-sm text-gray-400">
            <span>Step {step} of {TOTAL_STEPS}</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1.5">{heading.title}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{heading.subtitle}</p>
          </div>

          {/* Step content */}
          <div className="mb-10">{renderStep()}</div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => navigate(step - 1, "back")}
              className={`text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors ${
                step === 1 ? "invisible" : ""
              }`}
            >
              ← Back
            </button>

            <div className="flex items-center gap-3">
              {step < TOTAL_STEPS && (
                <button
                  type="button"
                  onClick={() => navigate(step + 1, "forward")}
                  className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  Skip
                </button>
              )}
              <button
                type="button"
                onClick={
                  step < TOTAL_STEPS
                    ? () => navigate(step + 1, "forward")
                    : handleComplete
                }
                disabled={!canContinue() || submitting}
                className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 flex items-center gap-2 ${
                  canContinue() && !submitting
                    ? "bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                }`}
              >
                {submitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V4a10 10 0 100 20v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                    </svg>
                    Saving…
                  </>
                ) : step < TOTAL_STEPS ? (
                  <>Continue <span className="opacity-70">→</span></>
                ) : (
                  <>Finish setup ✓</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
