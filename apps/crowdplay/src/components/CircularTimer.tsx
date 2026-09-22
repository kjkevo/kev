"use client";

/**
 * A ring that starts full and "uncircles" itself as time runs out —
 * used anywhere a phase is about to auto-advance (reveal, leaderboard) or
 * a stalled face-off is about to force a resolution, so it's visually
 * obvious something is about to change before it actually does.
 */
export function CircularTimer({
  fraction,
  size = 44,
  strokeWidth = 4,
  color = "#fbbf24",
  trackColor = "rgba(255,255,255,0.15)",
  label,
}: {
  fraction: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string | number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(1, fraction)));

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.1s linear" }}
        />
      </svg>
      {label !== undefined && (
        <span className="absolute text-xs font-bold tabular-nums" style={{ color }}>
          {label}
        </span>
      )}
    </div>
  );
}
