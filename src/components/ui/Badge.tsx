import * as React from "react";

/* ─── Types ─────────────────────────────────────────────────────────────── */

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/* ─── Variant styles ─────────────────────────────────────────────────────── */

const variantClasses: Record<BadgeVariant, string> = {
  // Teal — primary accent (ICP match, qualified, active)
  accent: "bg-[rgba(0,229,196,0.12)] text-[#00E5C4] ring-1 ring-[rgba(0,229,196,0.2)]",

  // Emerald — positive / won / verified
  success: "bg-[rgba(52,211,153,0.1)] text-[#34D399] ring-1 ring-[rgba(52,211,153,0.18)]",

  // Amber — pending / needs attention
  warning: "bg-[rgba(251,191,36,0.1)] text-[#FBBF24] ring-1 ring-[rgba(251,191,36,0.18)]",

  // Rose — lost / error / blocked
  danger: "bg-[rgba(251,113,133,0.1)] text-[#FB7185] ring-1 ring-[rgba(251,113,133,0.18)]",

  // Sky — informational / in progress
  info: "bg-[rgba(56,189,248,0.1)] text-[#38BDF8] ring-1 ring-[rgba(56,189,248,0.18)]",

  // Slate — default / new / unset
  neutral: "bg-[rgba(148,163,184,0.1)] text-[#94A3B8] ring-1 ring-[rgba(148,163,184,0.12)]",
};

/* ─── Badge ──────────────────────────────────────────────────────────────── */

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "neutral", className = "", children, ...props }, ref) => (
    <span
      ref={ref}
      className={[
        // base
        "inline-flex items-center justify-center",
        "rounded-md px-2 py-0.5",
        "font-mono font-medium",
        "text-[11px] tracking-widest uppercase",
        "whitespace-nowrap leading-none",
        // variant
        variantClasses[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </span>
  ),
);

Badge.displayName = "Badge";

export { Badge };
export type { BadgeProps, BadgeVariant };
