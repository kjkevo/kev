"use client";

/**
 * The few seconds before a question's clock starts: what's coming and a big
 * countdown, so nobody who glanced away loses time on the first question.
 */
export function GetReady({
  title = "Get ready!",
  subtitle,
  seconds,
  big = false,
}: {
  title?: string;
  subtitle?: string;
  seconds: number;
  big?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center animate-pop-in">
      <p className={`uppercase tracking-widest text-slate-400 ${big ? "text-2xl" : "text-sm"}`}>{title}</p>
      {subtitle && <p className={`font-black text-amber-400 ${big ? "text-6xl" : "text-3xl"}`}>{subtitle}</p>}
      <div
        key={seconds}
        className={`rounded-full bg-white/10 border-4 border-amber-400 flex items-center justify-center font-black tabular-nums animate-pop-in ${
          big ? "w-48 h-48 text-8xl" : "w-28 h-28 text-6xl"
        }`}
      >
        {Math.max(1, seconds)}
      </div>
    </div>
  );
}
