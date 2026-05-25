import * as React from "react";

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  /** Small-caps muted label rendered above the input */
  label?: string;
  /** Icon/element absolutely positioned on the left inside the input */
  prefix?: React.ReactNode;
  /** Activates red border + ring + shows message below */
  error?: string;
  /** Muted hint shown below when there is no error */
  hint?: string;
  /** Forward a ref to the underlying <input> */
}

/* ─── Input ──────────────────────────────────────────────────────────────── */

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      prefix,
      error,
      hint,
      id,
      className = "",
      disabled,
      ...props
    },
    ref,
  ) => {
    // Generate a stable id for label↔input association when none is provided
    const innerId = React.useId();
    const inputId = id ?? innerId;

    const hasError = Boolean(error);

    /* ── border / ring classes driven by state ── */
    const ringBase = "transition-all duration-150 outline-none";

    // default — subtle white border
    const borderDefault = "border border-white/10 bg-[#0D1526] text-white placeholder:text-[#475569]";

    // focus — teal border + soft teal glow ring
    const focusClasses = !hasError
      ? [
          "focus:border-[#00E5C4]",
          "focus:ring-2 focus:ring-[rgba(0,229,196,0.2)]",
          "focus:ring-offset-0",
        ].join(" ")
      : "";

    // error — rose border + rose ring (overrides focus teal)
    const errorClasses = hasError
      ? [
          "border-rose-500/60",
          "ring-2 ring-rose-500/20",
          "focus:border-rose-500",
          "focus:ring-rose-500/30",
        ].join(" ")
      : "";

    // hover — brightens border when not focused, not disabled
    const hoverClasses = !hasError ? "hover:border-white/20" : "";

    // disabled
    const disabledClasses = disabled
      ? "opacity-40 cursor-not-allowed"
      : "";

    /* ── padding: extra left room when prefix icon present ── */
    const paddingX = prefix ? "pl-9 pr-3.5" : "px-3.5";

    return (
      <div className="flex flex-col gap-1.5 w-full">

        {/* ── Label ── */}
        {label && (
          <label
            htmlFor={inputId}
            className={[
              "text-[11px] font-medium uppercase tracking-widest",
              hasError ? "text-rose-400" : "text-[#64748B]",
            ].join(" ")}
          >
            {label}
          </label>
        )}

        {/* ── Input wrapper ── */}
        <div className="relative flex items-center">

          {/* Prefix icon */}
          {prefix && (
            <span
              className="pointer-events-none absolute left-3 flex items-center text-[#475569]"
              aria-hidden="true"
            >
              {prefix}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={
              error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            className={[
              "w-full h-9 rounded-lg text-sm",
              borderDefault,
              paddingX,
              ringBase,
              focusClasses,
              errorClasses,
              hoverClasses,
              disabledClasses,
              className,
            ].join(" ")}
            {...props}
          />
        </div>

        {/* ── Error message ── */}
        {error && (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="text-[11px] text-rose-400 leading-snug flex items-start gap-1"
          >
            {/* inline exclamation icon */}
            <svg
              className="w-3 h-3 mt-px shrink-0"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1" />
              <path d="M6 3.5v3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
              <circle cx="6" cy="8.25" r="0.625" fill="currentColor" />
            </svg>
            {error}
          </p>
        )}

        {/* ── Hint (only shown when no error) ── */}
        {hint && !error && (
          <p
            id={`${inputId}-hint`}
            className="text-[11px] text-[#475569] leading-snug"
          >
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input };
export type { InputProps };
