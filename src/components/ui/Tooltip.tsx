"use client";

import * as React from "react";

/* ─── Types ─────────────────────────────────────────────────────────────── */

type TooltipPosition = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  /** Text or content shown inside the tooltip */
  content: React.ReactNode;
  /** Position relative to the trigger. Default: top */
  position?: TooltipPosition;
  /** The element that triggers the tooltip */
  children: React.ReactNode;
  /** Extra classes on the wrapper span */
  className?: string;
  /** Delay before showing (ms). Default: 120 */
  delay?: number;
}

/* ─── Position styles ────────────────────────────────────────────────────── */

/**
 * Each position entry:
 *   tooltip  — absolute positioning of the bubble
 *   arrow    — the small triangle pseudo-arrow (rendered as a rotated div)
 *   arrowPos — where to place the arrow div inside the bubble
 *   enter    — starting transform for the fade-in animation
 */
const positionMap: Record<
  TooltipPosition,
  {
    tooltip: string;
    arrow: string;
    enter: string;
  }
> = {
  top: {
    tooltip: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    arrow:
      "absolute top-full left-1/2 -translate-x-1/2 -mt-px border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[#1E293B]",
    enter: "translate-y-1",
  },
  bottom: {
    tooltip: "top-full left-1/2 -translate-x-1/2 mt-2",
    arrow:
      "absolute bottom-full left-1/2 -translate-x-1/2 -mb-px border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-[#1E293B]",
    enter: "-translate-y-1",
  },
  left: {
    tooltip: "right-full top-1/2 -translate-y-1/2 mr-2",
    arrow:
      "absolute left-full top-1/2 -translate-y-1/2 -ml-px border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent border-l-[#1E293B]",
    enter: "translate-x-1",
  },
  right: {
    tooltip: "left-full top-1/2 -translate-y-1/2 ml-2",
    arrow:
      "absolute right-full top-1/2 -translate-y-1/2 -mr-px border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-[#1E293B]",
    enter: "-translate-x-1",
  },
};

/* ─── Tooltip ────────────────────────────────────────────────────────────── */

const Tooltip = ({
  content,
  position = "top",
  children,
  className = "",
  delay = 120,
}: TooltipProps) => {
  const [visible, setVisible] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const { tooltip, arrow, enter } = positionMap[position];

  function show() {
    timerRef.current = setTimeout(() => {
      setMounted(true);
      // tiny rAF so the opacity transition actually fires
      requestAnimationFrame(() => setVisible(true));
    }, delay);
  }

  function hide() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
    // unmount after transition finishes
    setTimeout(() => setMounted(false), 150);
  }

  // Clean up on unmount
  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <span
      className={["relative inline-flex items-center", className].join(" ")}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}

      {mounted && (
        <span
          role="tooltip"
          className={[
            // position
            "absolute z-50 whitespace-nowrap",
            tooltip,
            // bubble
            "rounded-lg border border-white/10",
            "bg-[#0F172A] px-2.5 py-1.5",
            "text-[11px] font-medium text-[#CBD5E1] leading-snug",
            "shadow-[0_4px_16px_rgba(0,0,0,0.5)]",
            "pointer-events-none",
            // transition
            "transition-all duration-150",
            visible
              ? "opacity-100 translate-x-0 translate-y-0"
              : `opacity-0 ${enter}`,
          ].join(" ")}
        >
          {content}
          {/* Arrow */}
          <span className={arrow} aria-hidden="true" />
        </span>
      )}
    </span>
  );
};

Tooltip.displayName = "Tooltip";

export { Tooltip };
export type { TooltipProps, TooltipPosition };
