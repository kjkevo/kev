"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EditLeadModal from "@/app/components/EditLeadModal";
import AddLeadModal from "@/app/components/AddLeadModal";
import NotificationBell from "@/app/components/NotificationBell";
import ThemeToggle from "@/app/components/ThemeToggle";
import OnboardingChecklist from "@/app/components/OnboardingChecklist";

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
  status: string;
  notes: string | null;
  tags: string[];
  createdAt: string;
  aiScore?: number | null;
  aiScoreReason?: string | null;
  aiSuggestion?: string | null;
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
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
    filterActive: "bg-emerald-600 text-white border-emerald-600",
    dot: "bg-emerald-400",
    icon: "💰",
    label: "Funding",
  },
  Hiring: {
    badge: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
    filterActive: "bg-blue-600 text-white border-blue-600",
    dot: "bg-blue-400",
    icon: "🧑‍💻",
    label: "Hiring",
  },
  Competitor: {
    badge: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800",
    filterActive: "bg-rose-600 text-white border-rose-600",
    dot: "bg-rose-400",
    icon: "⚔️",
    label: "Competitor",
  },
  Engagement: {
    badge: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
    filterActive: "bg-amber-500 text-white border-amber-500",
    dot: "bg-amber-400",
    icon: "🎯",
    label: "Engagement",
  },
  Content: {
    badge: "bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800",
    filterActive: "bg-violet-600 text-white border-violet-600",
    dot: "bg-violet-400",
    icon: "📝",
    label: "Content",
  },
  Other: {
    badge: "bg-gray-50 text-gray-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600",
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

const TAG_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
];

function tagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

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
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type User = { name: string | null; email: string | null };

export default function DashboardClient({
  leads: initialLeads,
  user,
}: {
  leads: Lead[];
  user: User;
}) {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<TriggerType | "all">("all");
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [showAddLead, setShowAddLead] = useState(false);
  const [scoringId, setScoringId] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Listen for openAddLeadModal events from CommandPalette / KeyboardShortcuts
  useEffect(() => {
    function handleOpenAddLead() {
      setShowAddLead(true);
    }
    window.addEventListener("shortcut-open-add-lead", handleOpenAddLead);
    return () => window.removeEventListener("shortcut-open-add-lead", handleOpenAddLead);
  }, []);

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

  // --------------------------------------------------------------------------
  // Delete lead
  // --------------------------------------------------------------------------
  async function deleteLead(id: number) {
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setConfirmDeleteId(null);
  }

  // --------------------------------------------------------------------------
  // CSV Export
  // --------------------------------------------------------------------------
  function exportCSV() {
    window.location.href = "/api/leads/export";
  }

  // --------------------------------------------------------------------------
  // CSV Import
  // --------------------------------------------------------------------------
  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg("");
    const text = await file.text();
    try {
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: text,
      });
      const data = await res.json();
      setImportMsg(`Imported ${data.imported} lead${data.imported !== 1 ? "s" : ""}${data.skipped > 0 ? `, skipped ${data.skipped}` : ""}.`);
      // Refresh leads
      const leadsRes = await fetch("/api/leads");
      const leadsData = await leadsRes.json();
      setLeads(leadsData.map((l: Lead & { createdAt: string | Date }) => ({
        ...l,
        createdAt: typeof l.createdAt === "string" ? l.createdAt : new Date(l.createdAt).toISOString(),
      })));
    } catch {
      setImportMsg("Import failed. Please check your CSV format.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setImportMsg(""), 5000);
    }
  }

  // --------------------------------------------------------------------------
  // Edit saved
  // --------------------------------------------------------------------------
  function onLeadSaved(updated: Lead) {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  // --------------------------------------------------------------------------
  // Lead added
  // --------------------------------------------------------------------------
  function onLeadAdded(newLead: Lead) {
    setLeads((prev) => [newLead, ...prev]);
  }

  // --------------------------------------------------------------------------
  // AI Score
  // --------------------------------------------------------------------------
  async function scoreWithAI(id: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setScoringId(id);
    try {
      const res = await fetch(`/api/leads/${id}/score`, { method: "POST" });
      const data = await res.json();
      if (data.score !== undefined) {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === id ? { ...l, aiScore: data.score, aiScoreReason: data.reason } : l
          )
        );
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setScoringId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ── Sticky header ── */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold text-brand-700 shrink-0">
            LeadIQ
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500 dark:text-gray-400">
            <Link href="/" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Home</Link>
            <Link href="/dashboard" className="text-brand-600 font-semibold">Dashboard</Link>
            <Link href="/kanban" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Kanban</Link>
            <Link href="/leads" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">All Leads</Link>
            <Link href="/analytics" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Analytics</Link>
            <Link href="/team" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Team</Link>
            <Link href="/team-feed" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Feed</Link>
            <Link href="/pipeline" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Pipeline</Link>
            <Link href="/audit-log" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Audit Log</Link>
            <Link href="/settings" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Security</Link>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {/* ⌘K trigger chip — desktop only */}
            <button
              onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))}
              className="hidden md:flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <span>⌘K</span>
            </button>

            {(user.name || user.email) && (
              <span className="hidden sm:block text-xs text-gray-400 dark:text-gray-500 max-w-[180px] truncate">
                {user.name ?? user.email}
              </span>
            )}
            <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 px-3 py-1 rounded-full">
              {leads.length} lead{leads.length !== 1 ? "s" : ""}
            </span>
            <NotificationBell />
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="hidden sm:block text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              Sign out
            </button>

            {/* Hamburger — mobile only */}
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex flex-col gap-4 z-50 shadow-lg">
            <Link href="/" className="text-sm font-medium text-gray-700 dark:text-gray-300" onClick={() => setMobileMenuOpen(false)}>Home</Link>
            <Link href="/dashboard" className="text-sm font-semibold text-brand-600" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
            <Link href="/kanban" className="text-sm font-medium text-gray-700 dark:text-gray-300" onClick={() => setMobileMenuOpen(false)}>Kanban</Link>
            <Link href="/leads" className="text-sm font-medium text-gray-700 dark:text-gray-300" onClick={() => setMobileMenuOpen(false)}>All Leads</Link>
            <Link href="/analytics" className="text-sm font-medium text-gray-700 dark:text-gray-300" onClick={() => setMobileMenuOpen(false)}>Analytics</Link>
            <Link href="/team" className="text-sm font-medium text-gray-700 dark:text-gray-300" onClick={() => setMobileMenuOpen(false)}>Team</Link>
            <Link href="/team-feed" className="text-sm font-medium text-gray-700 dark:text-gray-300" onClick={() => setMobileMenuOpen(false)}>Feed</Link>
            <Link href="/pipeline" className="text-sm font-medium text-gray-700 dark:text-gray-300" onClick={() => setMobileMenuOpen(false)}>Pipeline</Link>
            <Link href="/audit-log" className="text-sm font-medium text-gray-700 dark:text-gray-300" onClick={() => setMobileMenuOpen(false)}>Audit Log</Link>
            <Link href="/settings" className="text-sm font-medium text-gray-700 dark:text-gray-300" onClick={() => setMobileMenuOpen(false)}>Security</Link>
            <Link href="/gdpr" className="text-sm font-medium text-gray-700 dark:text-gray-300" onClick={() => setMobileMenuOpen(false)}>Your Data Rights</Link>
            <button
              onClick={() => { signOut({ callbackUrl: "/" }); setMobileMenuOpen(false); }}
              className="text-sm font-medium text-gray-500 dark:text-gray-400 text-left"
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 sm:space-y-8">

        {/* ── Onboarding checklist ── */}
        <OnboardingChecklist />

        {/* ── Page heading ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Lead Intelligence Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">AI-enriched prospects, classified by buying signal</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Add Lead */}
            <button
              onClick={() => setShowAddLead(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 px-3 py-2 rounded-xl transition-colors"
            >
              + Add Lead
            </button>
            {/* CSV import */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileImport}
              className="hidden"
              id="csv-import"
            />
            <label
              htmlFor="csv-import"
              className={`cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 px-3 py-2 rounded-xl transition-colors ${importing ? "opacity-60 pointer-events-none" : ""}`}
            >
              <UploadIcon />
              {importing ? "Importing…" : "Import CSV"}
            </label>
            {/* CSV export */}
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 px-3 py-2 rounded-xl transition-colors"
            >
              <DownloadIcon />
              Export CSV
            </button>
            <Link
              href="/leads"
              className="text-sm font-medium text-brand-600 hover:text-brand-700 underline-offset-2 hover:underline transition-colors"
            >
              View raw leads →
            </Link>
          </div>
        </div>

        {/* Import status message */}
        {importMsg && (
          <div className="bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 text-sm px-4 py-2 rounded-xl border border-brand-100 dark:border-brand-800">
            {importMsg}
          </div>
        )}

        {/* ── Signal-type stat cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {ALL_TYPES.map((type) => {
            const cfg = TRIGGER_CONFIG[type];
            const isActive = activeFilter === type;
            return (
              <button
                key={type}
                onClick={() => setActiveFilter(isActive ? "all" : type)}
                className={`rounded-xl border p-3 sm:p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  isActive
                    ? `${cfg.badge} shadow-sm scale-[1.02]`
                    : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-sm"
                }`}
              >
                <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{counts[type]}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 leading-none">{cfg.label}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Search + filter bar ── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <SearchIcon />
            </span>
            <input
              type="text"
              data-search
              placeholder="Search company, contact, or keyword…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500 transition"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <XIcon />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                activeFilter === "all"
                  ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                  : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
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
                  onClick={() => setActiveFilter(isActive ? "all" : type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    isActive
                      ? cfg.filterActive + " shadow-sm"
                      : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
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
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing{" "}
            <span className="font-semibold text-gray-900 dark:text-white">{filtered.length}</span>{" "}
            of{" "}
            <span className="font-semibold text-gray-900 dark:text-white">{leads.length}</span>{" "}
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm py-20 text-center">
            <p className="text-2xl mb-3">🔍</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No leads match your search.</p>
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
              const isConfirmDelete = confirmDeleteId === lead.id;
              return (
                <article
                  key={lead.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all overflow-hidden"
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
                          <span className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                            {lead.contactName}
                          </span>
                          <span className="text-gray-300 dark:text-gray-600 text-xs hidden sm:inline">·</span>
                          <span className="text-gray-500 dark:text-gray-400 text-sm hidden sm:inline">{lead.title}</span>
                          <span className="text-gray-300 dark:text-gray-600 text-xs hidden sm:inline">·</span>
                          <Link
                            href={`/leads/${lead.id}`}
                            className="text-brand-600 font-semibold text-sm hover:underline underline-offset-2 flex items-center gap-1"
                          >
                            {lead.companyName}
                            {lead.website && <ExternalLinkIcon />}
                          </Link>
                        </div>

                        <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 sm:hidden">{lead.title}</p>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1.5">
                          <a
                            href={`mailto:${lead.email}`}
                            className="text-xs text-gray-400 dark:text-gray-500 hover:text-brand-600 transition-colors"
                          >
                            {lead.email}
                          </a>
                          {lead.phone && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">{lead.phone}</span>
                          )}
                        </div>

                        {/* Tags */}
                        {lead.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {lead.tags.map((tag) => (
                              <span
                                key={tag}
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${tagColor(tag)}`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right side: type badge + AI score + date + actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span
                        className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>

                      {/* AI Score badge */}
                      {lead.aiScore !== null && lead.aiScore !== undefined ? (
                        <span
                          title={lead.aiScoreReason ?? ""}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            lead.aiScore >= 70
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : lead.aiScore >= 40
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                          }`}
                        >
                          AI {lead.aiScore}
                        </span>
                      ) : null}

                      <time className="text-xs text-gray-400 dark:text-gray-500">{formatDate(lead.createdAt)}</time>

                      {/* Edit / Delete / Score buttons */}
                      <div className="flex items-center gap-1.5">
                        {!isConfirmDelete ? (
                          <>
                            <button
                              onClick={(e) => scoreWithAI(lead.id, e)}
                              disabled={scoringId === lead.id}
                              title="Score with AI"
                              className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-lg transition-colors text-xs font-medium disabled:opacity-60"
                            >
                              {scoringId === lead.id ? "…" : "✨"}
                            </button>
                            <button
                              onClick={() => setEditingLead(lead)}
                              title="Edit lead"
                              className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors"
                            >
                              <PencilIcon />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(lead.id)}
                              title="Delete lead"
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                            >
                              <TrashIcon />
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Delete?</span>
                            <button
                              onClick={() => deleteLead(lead.id)}
                              className="text-xs bg-rose-600 text-white px-2 py-1 rounded-lg hover:bg-rose-700 font-medium"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium"
                            >
                              No
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Intelligence panel ── */}
                  <div className="border-t border-gray-50 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/60 px-5 sm:px-6 py-4 space-y-3">
                    <div className="flex gap-3 items-start">
                      <span className="shrink-0 mt-px text-xs font-bold uppercase tracking-wider text-orange-600 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 px-2.5 py-1 rounded-full leading-none">
                        Trigger
                      </span>
                      <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{lead.triggerEvent}</p>
                    </div>

                    <div className="flex gap-3 items-start">
                      <span className="shrink-0 mt-px text-xs font-bold uppercase tracking-wider text-brand-600 bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 px-2.5 py-1 rounded-full leading-none">
                        Intel
                      </span>
                      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{lead.intelligenceSummary}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="h-8" />
      </main>

      {/* Edit modal */}
      {editingLead && (
        <EditLeadModal
          lead={editingLead}
          onClose={() => setEditingLead(null)}
          onSaved={onLeadSaved}
        />
      )}

      {/* Add Lead modal */}
      {showAddLead && (
        <AddLeadModal
          onClose={() => setShowAddLead(false)}
          onSaved={onLeadAdded}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-12 py-6 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-4 text-xs text-gray-400 dark:text-gray-500 justify-between items-center">
          <span>&copy; {new Date().getFullYear()} LeadIQ</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Privacy Policy</Link>
            <Link href="/gdpr" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Your Data Rights</Link>
            <Link href="/settings" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Security</Link>
            <Link href="/audit-log" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Audit Log</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
