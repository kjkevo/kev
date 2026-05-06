"use client";

import { useState, useMemo } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Lead = {
  id: number;
  companyName: string;
  website: string | null;
  contactName: string;
  title: string;
  email: string;
  phone: string | null;
  triggerEvent: string;
  intelligenceSummary: string;
  createdAt: string;
};

type TriggerType = "Funding" | "Hiring" | "Competitor" | "Engagement" | "Content" | "Other";

// ---------------------------------------------------------------------------
// Signal classification
// ---------------------------------------------------------------------------

function classifyTrigger(trigger: string): TriggerType {
  const t = trigger.toLowerCase();
  if (/series|raised|funding|round|\$\d/.test(t)) return "Funding";
  if (/job|hir|engineer|recruit|role|devops|sre|position/.test(t)) return "Hiring";
  if (/competitor|price|switch|g2|alternative|crm|moved away/.test(t)) return "Competitor";
  if (/webinar|attended|demo|event|stayed/.test(t)) return "Engagement";
  if (/blog|post|publish|article|wrote/.test(t)) return "Content";
  return "Other";
}

// ---------------------------------------------------------------------------
// Design tokens per trigger type
// ---------------------------------------------------------------------------

type TriggerConfig = {
  badge: string;
  filterActive: string;
  dot: string;
  icon: string;
  label: string;
};

const TRIGGER_CONFIG: Record<TriggerType, TriggerConfig> = {
  Funding: {
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    filterActive: "bg-emerald-600 text-white border-emerald-600",
    dot: "bg-emerald-400",
    icon: "💰",
    label: "Funding",
  },
  Hiring: {
    badge: "bg-blue-50 text-blue-700 border border-blue-200",
    filterActive: "bg-blue-600 text-white border-blue-600",
    dot: "bg-blue-400",
    icon: "🧑‍💻",
    label: "Hiring",
  },
  Competitor: {
    badge: "bg-rose-50 text-rose-700 border border-rose-200",
    filterActive: "bg-rose-600 text-white border-rose-600",
    dot: "bg-rose-400",
    icon: "⚔️",
    label: "Competitor",
  },
  Engagement: {
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    filterActive: "bg-amber-500 text-white border-amber-500",
    dot: "bg-amber-400",
    icon: "🎯",
    label: "Engagement",
  },
  Content: {
    badge: "bg-violet-50 text-violet-700 border border-violet-200",
    filterActive: "bg-violet-600 text-white border-violet-600",
    dot: "bg-violet-400",
    icon: "📝",
    label: "Content",
  },
  Other: {
    badge: "bg-gray-50 text-gray-600 border border-gray-200",
    filterActive: "bg-gray-600 text-white border-gray-600",
    dot: "bg-gray-400",
    icon: "📌",
    label: "Other",
  },
};

const ALL_TYPES: TriggerType[] = [
  "Funding",
  "Hiring",
  "Competitor",
  "Engagement",
  "Content",
  "Other",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-indigo-500",
];

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SearchIcon() {
  return (
    <svg
      className="w-4 h-4 text-gray-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
      />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      className="w-3 h-3 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type User = { name: string | null; email: string | null };

export default function DashboardClient({
  leads,
  user,
}: {
  leads: Lead[];
  user: User;
}) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<TriggerType | "all">("all");

  const enriched = useMemo(
    () => leads.map((l) => ({ ...l, triggerType: classifyTrigger(l.triggerEvent) })),
    [leads]
  );

  const counts = useMemo(() => {
    const c = {} as Record<TriggerType, number>;
    for (const t of ALL_TYPES) c[t] = 0;
    for (const l of enriched) c[l.triggerType]++;
    return c;
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return enriched.filter((l) => {
      const matchesQuery =
        !q ||
        l.companyName.toLowerCase().includes(q) ||
        l.contactName.toLowerCase().includes(q) ||
        l.triggerEvent.toLowerCase().includes(q) ||
        l.intelligenceSummary.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q);
      const matchesFilter = activeFilter === "all" || l.triggerType === activeFilter;
      return matchesQuery && matchesFilter;
    });
  }, [enriched, query, activeFilter]);

  const hasActiveFilters = query !== "" || activeFilter !== "all";

  function clearFilters() {
    setQuery("");
    setActiveFilter("all");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Sticky header ── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold text-brand-700 shrink-0">
            LeadIQ
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500">
            <Link href="/" className="hover:text-gray-900 transition-colors">
              Home
            </Link>
            <Link href="/dashboard" className="text-brand-600 font-semibold">
              Dashboard
            </Link>
            <Link href="/leads" className="hover:text-gray-900 transition-colors">
              All Leads
            </Link>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {(user.name || user.email) && (
              <span className="hidden sm:block text-xs text-gray-400 max-w-[180px] truncate">
                {user.name ?? user.email}
              </span>
            )}
            <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
              {leads.length} lead{leads.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* ── Page heading ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Lead Intelligence Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              AI-enriched prospects, classified by buying signal
            </p>
          </div>
          <Link
            href="/leads"
            className="self-start sm:self-auto text-sm font-medium text-brand-600 hover:text-brand-700 underline-offset-2 hover:underline transition-colors"
          >
            View raw leads →
          </Link>
        </div>

        {/* ── Signal-type stat cards ── */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {ALL_TYPES.map((type) => {
            const cfg = TRIGGER_CONFIG[type];
            const isActive = activeFilter === type;
            return (
              <button
                key={type}
                onClick={() =>
                  setActiveFilter(isActive ? "all" : type)
                }
                className={`rounded-xl border p-3 sm:p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  isActive
                    ? `${cfg.badge} shadow-sm scale-[1.02]`
                    : "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"
                }`}
              >
                <p className="text-2xl font-extrabold text-gray-900">
                  {counts[type]}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <p className="text-xs font-medium text-gray-500 leading-none">
                    {cfg.label}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Search + filter bar ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search company, contact, or keyword…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder-gray-400 transition"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XIcon />
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                activeFilter === "all"
                  ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              All signals
            </button>
            {ALL_TYPES.filter((t) => counts[t] > 0).map((type) => {
              const cfg = TRIGGER_CONFIG[type];
              const isActive = activeFilter === type;
              return (
                <button
                  key={type}
                  onClick={() =>
                    setActiveFilter(isActive ? "all" : type)
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    isActive
                      ? cfg.filterActive + " shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {cfg.icon} {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Results count + clear ── */}
        <div className="flex items-center justify-between -mt-4">
          <p className="text-sm text-gray-500">
            Showing{" "}
            <span className="font-semibold text-gray-900">{filtered.length}</span>{" "}
            of{" "}
            <span className="font-semibold text-gray-900">{leads.length}</span>{" "}
            leads
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
            >
              <XIcon />
              Clear filters
            </button>
          )}
        </div>

        {/* ── Lead cards ── */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
            <p className="text-2xl mb-3">🔍</p>
            <p className="text-gray-500 text-sm font-medium">
              No leads match your search.
            </p>
            <button
              onClick={clearFilters}
              className="mt-3 text-xs text-brand-600 hover:text-brand-700 font-medium hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((lead) => {
              const cfg = TRIGGER_CONFIG[lead.triggerType];
              const color = avatarColor(lead.contactName);
              return (
                <article
                  key={lead.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden"
                >
                  {/* ── Contact row ── */}
                  <div className="px-5 sm:px-6 py-5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div
                        className={`${color} w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 select-none`}
                      >
                        {initials(lead.contactName)}
                      </div>

                      {/* Name / title / company */}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap leading-snug">
                          <span className="font-semibold text-gray-900 text-sm sm:text-base">
                            {lead.contactName}
                          </span>
                          <span className="text-gray-300 text-xs hidden sm:inline">
                            ·
                          </span>
                          <span className="text-gray-500 text-sm hidden sm:inline">
                            {lead.title}
                          </span>
                          <span className="text-gray-300 text-xs hidden sm:inline">
                            ·
                          </span>
                          {lead.website ? (
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand-600 font-semibold text-sm hover:underline underline-offset-2 flex items-center gap-1"
                            >
                              {lead.companyName}
                              <ExternalLinkIcon />
                            </a>
                          ) : (
                            <span className="text-brand-600 font-semibold text-sm">
                              {lead.companyName}
                            </span>
                          )}
                        </div>

                        {/* Mobile: title on its own line */}
                        <p className="text-gray-500 text-xs mt-0.5 sm:hidden">
                          {lead.title}
                        </p>

                        {/* Contact details */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1.5">
                          <a
                            href={`mailto:${lead.email}`}
                            className="text-xs text-gray-400 hover:text-brand-600 transition-colors"
                          >
                            {lead.email}
                          </a>
                          {lead.phone && (
                            <span className="text-xs text-gray-400">
                              {lead.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side: type badge + date */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span
                        className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}
                        />
                        {cfg.label}
                      </span>
                      <time className="text-xs text-gray-400">
                        {formatDate(lead.createdAt)}
                      </time>
                    </div>
                  </div>

                  {/* ── Intelligence panel ── */}
                  <div className="border-t border-gray-50 bg-gray-50/60 px-5 sm:px-6 py-4 space-y-3">
                    {/* Trigger event */}
                    <div className="flex gap-3 items-start">
                      <span className="shrink-0 mt-px text-xs font-bold uppercase tracking-wider text-orange-600 bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-full leading-none">
                        Trigger
                      </span>
                      <p className="text-sm text-gray-800 leading-relaxed">
                        {lead.triggerEvent}
                      </p>
                    </div>

                    {/* Intel summary */}
                    <div className="flex gap-3 items-start">
                      <span className="shrink-0 mt-px text-xs font-bold uppercase tracking-wider text-brand-600 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-full leading-none">
                        Intel
                      </span>
                      <p className="text-sm text-gray-500 leading-relaxed">
                        {lead.intelligenceSummary}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* ── Footer spacer ── */}
        <div className="h-8" />
      </main>
    </div>
  );
}
