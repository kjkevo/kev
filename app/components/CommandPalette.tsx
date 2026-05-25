"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

type Lead = {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  status: string;
};

type NavCommand = {
  kind: "nav";
  id: string;
  label: string;
  hint: string;
  href: string;
};

type ActionCommand = {
  kind: "action";
  id: string;
  label: string;
  hint: string;
  action: () => void;
};

type LeadCommand = {
  kind: "lead";
  id: string;
  label: string;
  sub: string;
  status: string;
  href: string;
};

type Command = NavCommand | ActionCommand | LeadCommand;

const NAV_COMMANDS: NavCommand[] = [
  { kind: "nav", id: "nav-dashboard", label: "Dashboard", hint: "D", href: "/dashboard" },
  { kind: "nav", id: "nav-kanban", label: "Kanban Board", hint: "K", href: "/kanban" },
  { kind: "nav", id: "nav-analytics", label: "Analytics", hint: "A", href: "/analytics" },
  { kind: "nav", id: "nav-team", label: "Team", hint: "", href: "/team" },
  { kind: "nav", id: "nav-feed", label: "Activity Feed", hint: "", href: "/team-feed" },
  { kind: "nav", id: "nav-pipeline", label: "Pipeline Settings", hint: "", href: "/pipeline" },
];

const STATUS_COLORS: Record<string, string> = {
  new: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  contacted: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  qualified: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  proposal: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  negotiation: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  won: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  lost: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

// Global event for opening palette from other components
export const OPEN_COMMAND_PALETTE_EVENT = "open-command-palette";

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Listen for open events from other components
  useEffect(() => {
    function handleOpenEvent() {
      setOpen(true);
    }
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenEvent);
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenEvent);
  }, []);

  // Fetch leads when opening
  useEffect(() => {
    if (open && leads.length === 0) {
      fetch("/api/leads")
        .then((r) => r.ok ? r.json() : [])
        .then((data: Lead[]) => setLeads(data))
        .catch(() => {});
    }
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open, leads.length]);

  // Keyboard handler for Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const buildCommands = useCallback((): Command[] => {
    const q = query.toLowerCase();

    const navFiltered = NAV_COMMANDS.filter(
      (c) => !q || c.label.toLowerCase().includes(q)
    );

    const leadsFiltered: LeadCommand[] = leads
      .filter(
        (l) =>
          !q ||
          l.companyName.toLowerCase().includes(q) ||
          l.contactName.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q)
      )
      .slice(0, 8)
      .map((l) => ({
        kind: "lead" as const,
        id: `lead-${l.id}`,
        label: l.companyName,
        sub: l.contactName,
        status: l.status,
        href: `/leads/${l.id}`,
      }));

    const actionCommands: ActionCommand[] = ([
      {
        kind: "action" as const,
        id: "action-add",
        label: "Add new lead",
        hint: "N",
        action: () => {
          setOpen(false);
          window.dispatchEvent(new CustomEvent("shortcut-open-add-lead"));
        },
      },
      {
        kind: "action" as const,
        id: "action-export",
        label: "Export leads (CSV)",
        hint: "",
        action: () => {
          setOpen(false);
          window.location.href = "/api/leads/export";
        },
      },
    ] as ActionCommand[]).filter((c) => !q || c.label.toLowerCase().includes(q));

    return [
      ...navFiltered,
      ...leadsFiltered,
      ...actionCommands,
    ];
  }, [query, leads]);

  const commands = buildCommands();

  function execute(cmd: Command) {
    setOpen(false);
    if (cmd.kind === "nav" || cmd.kind === "lead") {
      router.push(cmd.href);
    } else {
      cmd.action();
    }
  }

  function handleKeyNav(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, commands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = commands[activeIndex];
      if (cmd) execute(cmd);
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  // Group commands for display
  const navCmds = commands.filter((c) => c.kind === "nav");
  const leadCmds = commands.filter((c) => c.kind === "lead");
  const actionCmds = commands.filter((c) => c.kind === "action");

  let globalIndex = 0;
  function getIdx() {
    return globalIndex++;
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-start justify-center pt-[15vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyNav}
            placeholder="Search commands, leads, navigation…"
            className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
          />
          <kbd className="hidden sm:inline-block text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 px-1.5 py-0.5 rounded font-mono">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {commands.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No results for &quot;{query}&quot;</p>
          )}

          {navCmds.length > 0 && (
            <div>
              <p className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Navigation</p>
              {navCmds.map((cmd) => {
                const idx = getIdx();
                return (
                  <button
                    key={cmd.id}
                    data-index={idx}
                    onClick={() => execute(cmd)}
                    className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 text-sm transition-colors ${
                      idx === activeIndex
                        ? "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <span className="font-medium">{cmd.label}</span>
                    </div>
                    {cmd.hint && (
                      <kbd className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono">
                        {cmd.hint}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {leadCmds.length > 0 && (
            <div>
              <p className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">Leads</p>
              {leadCmds.map((cmd) => {
                const idx = getIdx();
                return (
                  <button
                    key={cmd.id}
                    data-index={idx}
                    onClick={() => execute(cmd)}
                    className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 text-sm transition-colors ${
                      idx === activeIndex
                        ? "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="font-medium truncate">{cmd.label}</span>
                      <span className="text-xs text-gray-400 truncate">{cmd.sub}</span>
                    </div>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[cmd.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {cmd.status}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {actionCmds.length > 0 && (
            <div>
              <p className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">Actions</p>
              {actionCmds.map((cmd) => {
                const idx = getIdx();
                return (
                  <button
                    key={cmd.id}
                    data-index={idx}
                    onClick={() => execute(cmd)}
                    className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 text-sm transition-colors ${
                      idx === activeIndex
                        ? "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="font-medium">{cmd.label}</span>
                    </div>
                    {cmd.hint && (
                      <kbd className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono">
                        {cmd.hint}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2 flex items-center gap-4 text-xs text-gray-400">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> select</span>
          <span><kbd className="font-mono">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
