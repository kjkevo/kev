/**
 * A few simple line icons, so screens can say things with a symbol instead
 * of a sentence. They take the text color (currentColor).
 */
const PATHS: Record<string, string> = {
  check: "M5 12.5 10 17.5 19 7",
  x: "M6 6 18 18M18 6 6 18",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  star: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z",
  users: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 19v-1a4 4 0 0 0-3-3.9M15.5 3.1a3.5 3.5 0 0 1 0 6.8",
  user: "M19 20v-1a5 5 0 0 0-5-5h-4a5 5 0 0 0-5 5v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  hand: "M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1V4.5a1.5 1.5 0 0 1 3 0V12m0-6.5a1.5 1.5 0 0 1 3 0V12m0-3.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.4l-2.6-4.4a1.5 1.5 0 0 1 2.6-1.5L8 15",
  vote: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9",
  trophy: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18h2v2M18 18h2v2",
  swap: "M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7",
  plus: "M12 5v14M5 12h14",
  up: "M3 17l6-6 4 4 8-8M15 7h6v6",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 12h.01",
  flame: "M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8a7 7 0 0 0 7 7Z",
  crown: "M3 18h18M4 18 3 7l5 4 4-7 4 7 5-4-1 11",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  medal: "M8 3l2 6M16 3l-2 6M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM12 13v4",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  beer: "M6 8h9v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V8ZM15 11h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2M6 8a3 3 0 0 1 3-4h3a3 3 0 0 1 3 4",
  wand: "M4 20 15 9M14 4v3M19 9h-3M18 5l-2 2M11 3l.5 1.5M20 12l-1.5-.5",
  wolf: "M4 4l4 5h8l4-5v9a8 8 0 0 1-16 0V4ZM9 13h.01M15 13h.01M10 17h4",
  cloud: "M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18Z",
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className = "", strokeWidth = 2.2 }: { name: string; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d={PATHS[name] ?? ""} />
    </svg>
  );
}
