"use client";

import * as React from "react";
import { Search, Bell, Plus } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { Tooltip } from "@/src/components/ui/Tooltip";

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface TopBarProps {
  /** Page title displayed on the left */
  title: string;
  /** Whether the sidebar is currently collapsed — adjusts left offset */
  sidebarCollapsed?: boolean;
  /** Unread notification count — shows teal dot when > 0 */
  notificationCount?: number;
  /** Called when the bell is clicked */
  onNotificationsClick?: () => void;
  /** Called when "New Campaign" is clicked */
  onNewCampaign?: () => void;
  /** Search input value (controlled) */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

/* ─── Sidebar width constants (must match Sidebar.tsx) ──────────────────── */

const SIDEBAR_EXPANDED  = "left-[220px] w-[calc(100%-220px)]";
const SIDEBAR_COLLAPSED = "left-[60px]  w-[calc(100%-60px)]";

/* ─── TopBar ─────────────────────────────────────────────────────────────── */

export function TopBar({
  title,
  sidebarCollapsed = false,
  notificationCount = 0,
  onNotificationsClick,
  onNewCampaign,
  searchValue = "",
  onSearchChange,
}: TopBarProps) {
  const [localSearch, setLocalSearch] = React.useState(searchValue);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setLocalSearch(e.target.value);
    onSearchChange?.(e.target.value);
  }

  const hasNotifications = notificationCount > 0;

  return (
    <header
      className={[
        "fixed top-0 z-40",
        "flex items-center gap-4",
        "h-[56px] px-5",
        "bg-[#080D1A]/90 backdrop-blur-md",
        "border-b border-white/[0.06]",
        // smooth transition matching the sidebar
        "transition-[left,width] duration-200 ease-in-out",
        sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED,
      ].join(" ")}
    >

      {/* ── Left: page title ── */}
      <div className="shrink-0">
        <h1 className="text-sm font-semibold text-white tracking-tight leading-none">
          {title}
        </h1>
      </div>

      {/* ── Divider ── */}
      <div className="h-4 w-px bg-white/[0.08] shrink-0" />

      {/* ── Center: search ── */}
      <div className="flex-1 max-w-sm relative">
        <Search
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#334155] pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search leads, companies…"
          value={localSearch}
          onChange={handleSearch}
          aria-label="Search"
          className={[
            "w-full h-8 rounded-lg",
            "bg-[#0D1526] border border-white/[0.07]",
            "pl-8 pr-3 text-sm text-white placeholder:text-[#334155]",
            "transition-all duration-150 outline-none",
            "hover:border-white/[0.12]",
            "focus:border-[#00E5C4] focus:ring-2 focus:ring-[rgba(0,229,196,0.15)]",
          ].join(" ")}
        />
      </div>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Right: actions ── */}
      <div className="flex items-center gap-2 shrink-0">

        {/* Notification bell */}
        <Tooltip
          content={
            hasNotifications
              ? `${notificationCount} unread notification${notificationCount > 1 ? "s" : ""}`
              : "No new notifications"
          }
          position="bottom"
        >
          <button
            onClick={onNotificationsClick}
            aria-label={`Notifications${hasNotifications ? ` (${notificationCount} unread)` : ""}`}
            className={[
              "relative flex items-center justify-center",
              "w-8 h-8 rounded-lg",
              "text-[#475569] hover:text-[#94A3B8]",
              "hover:bg-white/[0.05]",
              "transition-all duration-150",
            ].join(" ")}
          >
            <Bell size={15} />

            {/* Teal dot indicator */}
            {hasNotifications && (
              <span className="absolute top-1.5 right-1.5 flex items-center justify-center">
                {/* Outer pulse ring */}
                <span className="absolute w-2 h-2 rounded-full bg-[#00E5C4] opacity-40 animate-ping" />
                {/* Solid dot */}
                <span className="relative w-1.5 h-1.5 rounded-full bg-[#00E5C4]" />
              </span>
            )}
          </button>
        </Tooltip>

        {/* New Campaign button */}
        <Button
          size="sm"
          variant="primary"
          icon={<Plus size={13} />}
          iconPosition="left"
          onClick={onNewCampaign}
        >
          New Campaign
        </Button>

      </div>
    </header>
  );
}
