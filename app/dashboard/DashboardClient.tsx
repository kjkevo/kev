"use client";

import { useState } from "react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

type NavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

type LeadStatus = "New" | "Contacted" | "Qualified" | "Meeting";

type Lead = {
  id: number;
  company: string;
  contact: string;
  title: string;
  score: number;
  signal: string;
  status: LeadStatus;
};

// ─── Data ────────────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  {
    id: "leads",
    label: "Leads",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    id: "icp",
    label: "ICP Builder",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "outreach",
    label: "Outreach",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
  },
];

const LEADS: Lead[] = [
  { id: 1,  company: "Vercel",      contact: "Sarah Chen",    title: "VP Sales",          score: 94, signal: "Hiring SDRs",         status: "Qualified"  },
  { id: 2,  company: "Linear",      contact: "Marcus Webb",   title: "CTO",               score: 88, signal: "New funding",          status: "Meeting"    },
  { id: 3,  company: "Stripe",      contact: "Priya Nair",    title: "Head of Growth",    score: 91, signal: "Team expansion",       status: "Contacted"  },
  { id: 4,  company: "Figma",       contact: "Jordan Kim",    title: "Dir. BD",           score: 79, signal: "Job spike",            status: "New"        },
  { id: 5,  company: "Notion",      contact: "Alex Torres",   title: "CMO",               score: 85, signal: "Series C closed",      status: "Qualified"  },
  { id: 6,  company: "Loom",        contact: "Dana Okafor",   title: "VP Marketing",      score: 82, signal: "Rebranding",           status: "Contacted"  },
  { id: 7,  company: "Brex",        contact: "Raj Mehta",     title: "Sales Director",    score: 76, signal: "Hiring AEs",           status: "New"        },
  { id: 8,  company: "Rippling",    contact: "Chloe Park",    title: "Head of Ops",       score: 89, signal: "New office opened",    status: "Meeting"    },
  { id: 9,  company: "Retool",      contact: "Sam Nguyen",    title: "CEO",               score: 71, signal: "Product launch",       status: "New"        },
  { id: 10, company: "Runway",      contact: "Maya Lin",      title: "Dir. Partnerships", score: 83, signal: "Series B",             status: "Contacted"  },
  { id: 11, company: "Descript",    contact: "Eli Strauss",   title: "VP Revenue",        score: 90, signal: "Acquired a startup",   status: "Qualified"  },
  { id: 12, company: "Pika Labs",   contact: "Nia Foster",    title: "Head of Growth",    score: 77, signal: "Viral product launch", status: "New"        },
];

const STATUS_STYLES: Record<LeadStatus, string> = {
  New:       "text-[#94A3B8] bg-white/5 border border-white/10",
  Contacted: "text-[#60A5FA] bg-blue-500/10 border border-blue-500/20",
  Qualified: "text-[#00E5C4] bg-[#00E5C4]/10 border border-[#00E5C4]/20",
  Meeting:   "text-[#FBBF24] bg-amber-500/10 border border-amber-500/20",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardClient() {
  const [activeNav, setActiveNav] = useState("leads");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLeads = LEADS.filter(
    (l) =>
      l.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#080D1A] overflow-hidden">
      {/* ─── Sidebar ─── */}
      <aside className="w-60 flex-shrink-0 bg-[#080D1A] border-r border-white/5 flex flex-col">
        {/* Wordmark */}
        <div className="h-16 flex items-center px-5 border-b border-white/5">
          <span className="text-[#00E5C4] font-bold text-base mr-1.5">■</span>
          <span className="font-semibold text-white tracking-tight">Pulse</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left relative ${
                  isActive
                    ? "text-[#00E5C4] bg-[#00E5C4]/8"
                    : "text-[#64748B] hover:text-[#94A3B8] hover:bg-white/5"
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 inset-y-2 w-0.5 bg-[#00E5C4] rounded-full" />
                )}
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-3 border-t border-white/5 space-y-3">
          {/* Upgrade card */}
          <div className="gradient-border rounded-xl p-3.5 bg-[#0D1526]">
            <p className="text-xs font-semibold text-white mb-0.5">Upgrade to Pro</p>
            <p className="text-xs text-[#64748B] mb-3 leading-relaxed">
              Unlock unlimited leads, AI sequences, and CRM sync.
            </p>
            <button className="w-full text-xs font-medium bg-[#00E5C4] text-[#080D1A] rounded-lg py-1.5 hover:bg-[#33EBD0] transition-colors">
              View plans
            </button>
          </div>

          {/* User avatar */}
          <div className="flex items-center gap-3 px-1 py-1">
            <div className="w-7 h-7 rounded-full bg-[#0D4A3E] border border-[#00E5C4]/20 flex items-center justify-center text-[10px] font-semibold text-[#00E5C4]">
              KT
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">Kevin Thomas</p>
              <p className="text-[10px] text-[#475569] truncate">Free plan</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Main content ─── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-[#080D1A] flex-shrink-0">
          <h1 className="text-sm font-semibold text-white capitalize">{activeNav === "icp" ? "ICP Builder" : activeNav.charAt(0).toUpperCase() + activeNav.slice(1)}</h1>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-[#0D1526] border border-white/5 rounded-lg text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#00E5C4]/30 focus:ring-1 focus:ring-[#00E5C4]/20 w-56 transition-all"
              />
            </div>

            {/* Add leads */}
            <button className="flex items-center gap-1.5 px-4 py-2 bg-[#00E5C4] text-[#080D1A] text-sm font-medium rounded-lg hover:bg-[#33EBD0] transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add leads
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "New leads today", value: "47", delta: "+12% vs yesterday" },
              { label: "Emails sent",     value: "128", delta: "34 sequences active" },
              { label: "Open rate",       value: "34%", delta: "+4.2 pts this week" },
              { label: "Meetings booked", value: "9",   delta: "3 this week" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-[#0D1526] border border-white/5 rounded-xl p-5"
              >
                <p className="text-xs text-[#475569] mb-2">{stat.label}</p>
                <p className="font-mono text-2xl font-semibold text-[#00E5C4]">{stat.value}</p>
                <p className="text-[10px] text-[#334155] mt-1.5">{stat.delta}</p>
              </div>
            ))}
          </div>

          {/* Leads table */}
          <div className="bg-[#0D1526] border border-white/5 rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[32px_2fr_2fr_2fr_80px_140px_100px_60px] gap-4 px-5 py-3 border-b border-white/5 text-[10px] text-[#475569] uppercase tracking-widest font-medium">
              <div />
              <div>Company</div>
              <div>Contact</div>
              <div>Title</div>
              <div>Score</div>
              <div>Signal</div>
              <div>Status</div>
              <div />
            </div>

            {/* Rows */}
            {filteredLeads.map((lead, i) => (
              <div
                key={lead.id}
                className={`group grid grid-cols-[32px_2fr_2fr_2fr_80px_140px_100px_60px] gap-4 px-5 py-3.5 border-b border-white/5 last:border-0 items-center hover:bg-white/[0.025] transition-colors cursor-pointer ${
                  i % 2 === 0 ? "bg-white/[0.01]" : ""
                }`}
              >
                {/* Checkbox */}
                <div>
                  <div className="w-4 h-4 rounded border border-white/10 group-hover:border-[#00E5C4]/40 transition-colors" />
                </div>

                {/* Company */}
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                    style={{
                      background: `hsl(${(lead.id * 47) % 360}, 40%, 25%)`,
                    }}
                  >
                    {lead.company.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-white">{lead.company}</span>
                </div>

                {/* Contact */}
                <div className="text-sm text-[#94A3B8]">{lead.contact}</div>

                {/* Title */}
                <div className="text-sm text-[#64748B]">{lead.title}</div>

                {/* Score */}
                <div>
                  <span className="font-mono text-xs font-semibold text-[#00E5C4] bg-[#00E5C4]/10 px-2 py-0.5 rounded">
                    {lead.score}
                  </span>
                </div>

                {/* Signal */}
                <div>
                  <span className="text-xs text-[#64748B] bg-white/5 px-2.5 py-1 rounded-full border border-white/5 whitespace-nowrap">
                    {lead.signal}
                  </span>
                </div>

                {/* Status */}
                <div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[lead.status]}`}
                  >
                    {lead.status}
                  </span>
                </div>

                {/* Action */}
                <div className="flex justify-end">
                  <button className="text-[#00E5C4] opacity-0 group-hover:opacity-100 transition-opacity hover:text-[#33EBD0]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-1">
            <p className="font-mono text-xs text-[#475569]">
              Showing 1–{filteredLeads.length} of 247 leads
            </p>
            <div className="flex items-center gap-1">
              {["‹", "1", "2", "3", "·", "21", "›"].map((p, i) => (
                <button
                  key={i}
                  className={`w-7 h-7 rounded text-xs font-mono transition-colors ${
                    p === "1"
                      ? "bg-[#00E5C4]/10 text-[#00E5C4] border border-[#00E5C4]/20"
                      : "text-[#475569] hover:text-white hover:bg-white/5"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
