"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Target,
  Users,
  Send,
  BarChart3,
  Settings,
  ChevronLeft,
  LogOut,
} from "lucide-react";
import { Avatar } from "@/src/components/ui/Avatar";
import { Tooltip } from "@/src/components/ui/Tooltip";

/* ─── Nav items ──────────────────────────────────────────────────────────── */

const NAV_ITEMS = [
  { label: "Dashboard",      href: "/dashboard",  icon: LayoutDashboard },
  { label: "ICP Builder",    href: "/icp",         icon: Target          },
  { label: "Lead Pipeline",  href: "/leads",       icon: Users           },
  { label: "Outreach",       href: "/outreach",    icon: Send            },
  { label: "Analytics",      href: "/analytics",   icon: BarChart3       },
] as const;

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface SidebarUser {
  name: string;
  workspace: string;
  avatarSrc?: string;
}

interface SidebarProps {
  user?: SidebarUser;
  /** Controlled: pass to sync collapsed state with parent */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Default collapsed state when uncontrolled */
  defaultCollapsed?: boolean;
}

/* ─── Sidebar ────────────────────────────────────────────────────────────── */

export function Sidebar({
  user,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  defaultCollapsed = false,
}: SidebarProps) {
  const pathname = usePathname();

  // Support both controlled and uncontrolled modes
  const [internalCollapsed, setInternalCollapsed] = React.useState(defaultCollapsed);
  const isCollapsed = controlledCollapsed ?? internalCollapsed;

  function toggle() {
    const next = !isCollapsed;
    setInternalCollapsed(next);
    onCollapsedChange?.(next);
  }

  /* ── derived widths ── */
  const wExpanded  = "w-[220px]";
  const wCollapsed = "w-[60px]";

  return (
    <aside
      className={[
        "relative flex flex-col h-screen shrink-0",
        "bg-[#080D1A] border-r border-white/[0.06]",
        "transition-[width] duration-200 ease-in-out",
        isCollapsed ? wCollapsed : wExpanded,
        "overflow-hidden",
      ].join(" ")}
    >

      {/* ── Logo ── */}
      <div
        className={[
          "flex items-center gap-3 px-3.5 border-b border-white/[0.06]",
          "h-[56px] shrink-0",
        ].join(" ")}
      >
        {/* Teal square icon */}
        <span className="shrink-0 w-7 h-7 rounded-md bg-[#00E5C4] flex items-center justify-center">
          <span className="font-mono font-bold text-[#080D1A] text-sm leading-none">P</span>
        </span>

        {/* Wordmark — fades out when collapsed */}
        <span
          className={[
            "font-mono font-semibold text-white text-sm tracking-[0.15em] uppercase",
            "transition-[opacity,width] duration-200 whitespace-nowrap overflow-hidden",
            isCollapsed ? "opacity-0 w-0" : "opacity-100 w-auto",
          ].join(" ")}
        >
          Pulse
        </span>
      </div>

      {/* ── Primary nav ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-0.5 px-2">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");

          const item = (
            <Link
              key={href}
              href={href}
              className={[
                "relative flex items-center gap-3 rounded-lg px-2.5 py-2.5",
                "text-sm font-medium transition-all duration-150 group",
                active
                  ? [
                      "bg-[rgba(0,229,196,0.08)] text-[#00E5C4]",
                      // left border accent via pseudo-element approach using box-shadow inset
                      "shadow-[inset_2px_0_0_#00E5C4]",
                    ].join(" ")
                  : [
                      "text-[#64748B]",
                      "hover:bg-white/[0.04] hover:text-[#CBD5E1]",
                    ].join(" "),
              ].join(" ")}
            >
              <Icon
                size={16}
                className={[
                  "shrink-0 transition-colors duration-150",
                  active ? "text-[#00E5C4]" : "text-[#475569] group-hover:text-[#94A3B8]",
                ].join(" ")}
              />
              <span
                className={[
                  "transition-[opacity,width] duration-200 whitespace-nowrap overflow-hidden",
                  isCollapsed ? "opacity-0 w-0" : "opacity-100",
                ].join(" ")}
              >
                {label}
              </span>

              {/* Teal glow behind active item */}
              {active && (
                <span
                  className="absolute inset-0 rounded-lg pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(ellipse 80% 100% at 0% 50%, rgba(0,229,196,0.07) 0%, transparent 70%)",
                  }}
                />
              )}
            </Link>
          );

          // Wrap in tooltip when collapsed so labels are still accessible
          return isCollapsed ? (
            <Tooltip key={href} content={label} position="right" delay={80}>
              {item}
            </Tooltip>
          ) : (
            <React.Fragment key={href}>{item}</React.Fragment>
          );
        })}
      </nav>

      {/* ── Bottom section ── */}
      <div className="shrink-0 border-t border-white/[0.06] px-2 py-3 space-y-0.5">

        {/* Settings */}
        {isCollapsed ? (
          <Tooltip content="Settings" position="right" delay={80}>
            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-[#64748B] hover:bg-white/[0.04] hover:text-[#CBD5E1] transition-all duration-150 group"
            >
              <Settings size={16} className="shrink-0 text-[#475569] group-hover:text-[#94A3B8] transition-colors" />
            </Link>
          </Tooltip>
        ) : (
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium text-[#64748B] hover:bg-white/[0.04] hover:text-[#CBD5E1] transition-all duration-150 group"
          >
            <Settings size={16} className="shrink-0 text-[#475569] group-hover:text-[#94A3B8] transition-colors" />
            <span className={["whitespace-nowrap overflow-hidden transition-[opacity,width] duration-200", isCollapsed ? "opacity-0 w-0" : "opacity-100"].join(" ")}>
              Settings
            </span>
          </Link>
        )}

        {/* User card */}
        {user && (
          <div
            className={[
              "flex items-center rounded-lg px-2.5 py-2 gap-3",
              "border border-white/[0.05] bg-white/[0.02]",
              "transition-all duration-200",
              isCollapsed ? "justify-center" : "justify-between",
            ].join(" ")}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar name={user.name} src={user.avatarSrc} size="sm" className="shrink-0" />
              <div
                className={[
                  "flex flex-col min-w-0 overflow-hidden transition-[opacity,width] duration-200",
                  isCollapsed ? "opacity-0 w-0" : "opacity-100",
                ].join(" ")}
              >
                <span className="text-xs font-medium text-white truncate leading-tight">
                  {user.name}
                </span>
                <span className="text-[10px] text-[#475569] truncate leading-tight font-mono">
                  {user.workspace}
                </span>
              </div>
            </div>

            {!isCollapsed && (
              <button
                aria-label="Log out"
                className="shrink-0 text-[#334155] hover:text-rose-400 transition-colors duration-150 p-0.5 rounded"
              >
                <LogOut size={13} />
              </button>
            )}
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={toggle}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={[
            "flex items-center gap-3 w-full rounded-lg px-2.5 py-2.5",
            "text-[#334155] hover:text-[#64748B] hover:bg-white/[0.03]",
            "transition-all duration-150",
            isCollapsed ? "justify-center" : "",
          ].join(" ")}
        >
          <ChevronLeft
            size={15}
            className={[
              "shrink-0 transition-transform duration-200",
              isCollapsed ? "rotate-180" : "rotate-0",
            ].join(" ")}
          />
          <span
            className={[
              "text-xs whitespace-nowrap overflow-hidden transition-[opacity,width] duration-200",
              isCollapsed ? "opacity-0 w-0" : "opacity-100",
            ].join(" ")}
          >
            Collapse
          </span>
        </button>
      </div>
    </aside>
  );
}
