"use client";

import * as React from "react";

/* ─── Types ─────────────────────────────────────────────────────────────── */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";
type IconPosition = "left" | "right";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: IconPosition;
}

/* ─── Style maps ─────────────────────────────────────────────────────────── */

const variantClasses: Record<Variant, string> = {
  primary: [
    "bg-[#00E5C4] text-[#080D1A] font-semibold",
    "hover:bg-[#33EBD0]",
    "shadow-[0_0_16px_rgba(0,229,196,0.2)] hover:shadow-[0_0_24px_rgba(0,229,196,0.35)]",
    "disabled:bg-[#00E5C4]/40 disabled:shadow-none",
  ].join(" "),

  secondary: [
    "bg-[#0D1526] text-white font-medium",
    "border border-white/10",
    "hover:bg-[#111D33] hover:border-white/20",
    "disabled:opacity-40",
  ].join(" "),

  ghost: [
    "bg-transparent text-[#94A3B8] font-medium",
    "hover:text-white hover:bg-white/5",
    "disabled:opacity-40",
  ].join(" "),

  danger: [
    "bg-transparent text-red-400 font-medium",
    "border border-red-500/30",
    "hover:bg-red-500/10 hover:border-red-500/60 hover:text-red-300",
    "disabled:opacity-40",
  ].join(" "),
};

const sizeClasses: Record<Size, string> = {
  sm: "h-7  px-3   text-xs  gap-1.5 rounded-md",
  md: "h-9  px-4   text-sm  gap-2   rounded-lg",
  lg: "h-11 px-5   text-sm  gap-2.5 rounded-xl",
};

const spinnerSizeClasses: Record<Size, string> = {
  sm: "w-3 h-3",
  md: "w-3.5 h-3.5",
  lg: "w-4 h-4",
};

/* ─── Spinner ────────────────────────────────────────────────────────────── */

function Spinner({ size }: { size: Size }) {
  return (
    <svg
      className={`${spinnerSizeClasses[size]} animate-spin shrink-0`}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/* ─── Button ─────────────────────────────────────────────────────────────── */

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      iconPosition = "left",
      disabled,
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    const base = [
      "inline-flex items-center justify-center",
      "whitespace-nowrap select-none",
      "transition-all duration-150",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5C4]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080D1A]",
      "active:scale-[0.97]",
      "disabled:cursor-not-allowed disabled:pointer-events-none",
    ].join(" ");

    const iconNode = loading ? <Spinner size={size} /> : icon ?? null;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[base, variantClasses[variant], sizeClasses[size], className].join(" ")}
        {...props}
      >
        {/* Left icon / spinner */}
        {iconNode && iconPosition === "left" && (
          <span className="shrink-0 leading-none">{iconNode}</span>
        )}

        {/* Label — hide visually while loading but keep for width stability */}
        {children && (
          <span className={loading ? "opacity-60" : undefined}>{children}</span>
        )}

        {/* Right icon */}
        {iconNode && iconPosition === "right" && !loading && (
          <span className="shrink-0 leading-none">{iconNode}</span>
        )}

        {/* Right spinner when loading and icon is on the right */}
        {loading && iconPosition === "right" && (
          <span className="shrink-0 leading-none">
            <Spinner size={size} />
          </span>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button };
export type { ButtonProps, Variant, Size };
