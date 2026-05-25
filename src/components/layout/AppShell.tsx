"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/* ─── Pages that render WITHOUT the app shell ────────────────────────────── */

const SHELL_EXCLUDED = ["/", "/login", "/signup", "/onboarding"];

function useShellVisible() {
  const pathname = usePathname();
  return !SHELL_EXCLUDED.includes(pathname);
}

/* ─── Width/height constants (must stay in sync with Sidebar + TopBar) ───── */

const TOPBAR_H   = 56;   // px
const SIDEBAR_W  = 220;  // px — expanded
const SIDEBAR_WC = 60;   // px — collapsed

/* ─── AppShell ───────────────────────────────────────────────────────────── */

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const showShell = useShellVisible();
  const [collapsed, setCollapsed] = React.useState(false);

  /* ── No shell — render children full-screen (landing page, auth pages) ── */
  if (!showShell) {
    return <>{children}</>;
  }

  const sidebarW = collapsed ? SIDEBAR_WC : SIDEBAR_W;

  return (
    <div className="flex h-screen overflow-hidden bg-[#080D1A]">

      {/* ── Sidebar ── */}
      <Sidebar
        user={{ name: "Sarah Chen", workspace: "Acme · Growth" }}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />

      {/* ── Right column ── */}
      <div
        className="flex flex-col flex-1 min-w-0 overflow-hidden transition-[margin-left] duration-200 ease-in-out"
        style={{ marginLeft: 0 }} // sidebar is in normal flow; flex handles the offset
      >

        {/* TopBar — fixed, tracks sidebar width */}
        <TopBar
          title={usePageTitle()}
          sidebarCollapsed={collapsed}
          notificationCount={3}
        />

        {/* Main content — pushed down by TopBar height */}
        <main
          className={[
            "flex-1 overflow-y-auto overflow-x-hidden",
            "transition-[padding-left] duration-200 ease-in-out",
          ].join(" ")}
          style={{ paddingTop: TOPBAR_H }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

/* ─── Derive page title from pathname ───────────────────────────────────── */

function usePageTitle(): string {
  const pathname = usePathname();

  const titles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/icp":       "ICP Builder",
    "/leads":     "Lead Pipeline",
    "/outreach":  "Outreach",
    "/analytics": "Analytics",
    "/settings":  "Settings",
  };

  // Exact match first, then prefix match
  if (titles[pathname]) return titles[pathname];
  const prefix = Object.keys(titles).find((k) => pathname.startsWith(k + "/"));
  return prefix ? titles[prefix] : "Pulse";
}
