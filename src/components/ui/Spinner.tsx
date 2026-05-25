import * as React from "react";

/* ─── Types ─────────────────────────────────────────────────────────────── */

type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";

interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: SpinnerSize;
  /** Override the stroke color. Defaults to #00E5C4 (teal accent). */
  color?: string;
  /** Accessible label for screen readers */
  label?: string;
}

/* ─── Size map ───────────────────────────────────────────────────────────── */

const sizeMap: Record<SpinnerSize, number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 28,
  xl: 40,
};

const strokeMap: Record<SpinnerSize, number> = {
  xs: 2.5,
  sm: 2.5,
  md: 2,
  lg: 2,
  xl: 1.75,
};

/* ─── Spinner ────────────────────────────────────────────────────────────── */

const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
  (
    {
      size = "md",
      color = "#00E5C4",
      label = "Loading…",
      className = "",
      style,
      ...props
    },
    ref,
  ) => {
    const px = sizeMap[size];
    const stroke = strokeMap[size];
    const r = (px - stroke * 2) / 2;         // radius that keeps the ring inside the viewBox
    const cx = px / 2;
    const circumference = 2 * Math.PI * r;

    return (
      <svg
        ref={ref}
        role="status"
        aria-label={label}
        width={px}
        height={px}
        viewBox={`0 0 ${px} ${px}`}
        fill="none"
        className={["shrink-0 animate-spin", className].join(" ")}
        style={{ animationDuration: "700ms", animationTimingFunction: "linear", ...style }}
        {...props}
      >
        {/* Track — dim version of accent */}
        <circle
          cx={cx}
          cy={cx}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeOpacity={0.15}
        />

        {/* Arc — visible 25% of circumference, fades at the tail */}
        <circle
          cx={cx}
          cy={cx}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.75}   // show ~25% of the circle
          style={{
            transformOrigin: "center",
          }}
        />
      </svg>
    );
  },
);

Spinner.displayName = "Spinner";

export { Spinner };
export type { SpinnerProps, SpinnerSize };
