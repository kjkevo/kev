"use client";

import * as React from "react";

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** When true: hover shows teal border + box-shadow glow */
  glow?: boolean;
  /** Slot rendered above the body, separated by a divider */
  header?: React.ReactNode;
  /** Slot rendered below the body, separated by a divider */
  footer?: React.ReactNode;
  /** Remove default padding from the body (useful for full-bleed content) */
  noPadding?: boolean;
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}
interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}
interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}
interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

/* ─── CSS variable injected once ─────────────────────────────────────────── */
// --accent-glow drives the teal glow consistently across the design system.
// We inject it on :root via a style tag so any component can reference it.

const GLOW_STYLE = `
  :root {
    --accent-glow: 0 0 0 1px rgba(0,229,196,0.45), 0 0 24px rgba(0,229,196,0.18);
    --border-default: rgba(255,255,255,0.07);
    --border-hover:   rgba(255,255,255,0.14);
    --border-glow:    rgba(0,229,196,0.45);
  }
`;

let styleInjected = false;
function injectGlowVar() {
  if (styleInjected || typeof document === "undefined") return;
  const tag = document.createElement("style");
  tag.textContent = GLOW_STYLE;
  document.head.appendChild(tag);
  styleInjected = true;
}

/* ─── Root Card ──────────────────────────────────────────────────────────── */

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      glow = false,
      header,
      footer,
      noPadding = false,
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    React.useEffect(() => { injectGlowVar(); }, []);

    const base = [
      "relative rounded-xl",
      "bg-[#0D1526]",
      "border border-[rgba(255,255,255,0.07)]",
      "transition-all duration-200",
      // default hover — subtly brightens the border
      "hover:border-[rgba(255,255,255,0.14)]",
    ].join(" ");

    const glowClasses = glow
      ? [
          // teal border + shadow glow on hover
          "hover:border-[rgba(0,229,196,0.45)]",
          "hover:[box-shadow:var(--accent-glow)]",
        ].join(" ")
      : "";

    return (
      <div
        ref={ref}
        className={[base, glowClasses, className].join(" ")}
        {...props}
      >
        {/* ── Header slot ── */}
        {header && (
          <>
            <div className="px-5 py-4">{header}</div>
            <div className="h-px bg-white/[0.06]" />
          </>
        )}

        {/* ── Body ── */}
        <div className={noPadding ? "" : "px-5 py-4"}>{children}</div>

        {/* ── Footer slot ── */}
        {footer && (
          <>
            <div className="h-px bg-white/[0.06]" />
            <div className="px-5 py-4">{footer}</div>
          </>
        )}
      </div>
    );
  },
);

Card.displayName = "Card";

/* ─── Composable sub-components ─────────────────────────────────────────── */

/** Drop-in header section — use inside the `header` prop or standalone */
const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = "", children, ...props }, ref) => (
    <div
      ref={ref}
      className={["flex flex-col gap-1.5", className].join(" ")}
      {...props}
    >
      {children}
    </div>
  ),
);
CardHeader.displayName = "CardHeader";

/** Heading text styled for card headers */
const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className = "", children, ...props }, ref) => (
    <h3
      ref={ref}
      className={[
        "text-sm font-semibold text-white leading-snug tracking-tight",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </h3>
  ),
);
CardTitle.displayName = "CardTitle";

/** Muted description below the title */
const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className = "", children, ...props }, ref) => (
    <p
      ref={ref}
      className={["text-xs text-[#64748B] leading-relaxed", className].join(" ")}
      {...props}
    >
      {children}
    </p>
  ),
);
CardDescription.displayName = "CardDescription";

/** Drop-in footer section */
const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = "", children, ...props }, ref) => (
    <div
      ref={ref}
      className={["flex items-center gap-3", className].join(" ")}
      {...props}
    >
      {children}
    </div>
  ),
);
CardFooter.displayName = "CardFooter";

/* ─── Exports ────────────────────────────────────────────────────────────── */

export { Card, CardHeader, CardTitle, CardDescription, CardFooter };
export type { CardProps };
