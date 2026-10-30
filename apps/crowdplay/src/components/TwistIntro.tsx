"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { TWIST_INTRO_SECONDS, TWISTS, type Twist } from "@/lib/twists";

/**
 * The 7-second "here comes a twist" screen before a twist question: the
 * twist's icon and name, what it's worth in big type with one short line
 * under it, a countdown ring, then it fades out as the question starts.
 */
export function TwistIntro({
  twist,
  description,
  personal,
  startedAt,
  big = false,
}: {
  twist: Twist;
  description: { headline: string; sub?: string };
  personal?: string | null;
  startedAt: string | null;
  big?: boolean;
}) {
  const t = TWISTS[twist];
  const start = startedAt ? Date.parse(startedAt) : Date.now();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  const remainingMs = Math.max(0, start + TWIST_INTRO_SECONDS * 1000 - now);
  const left = Math.ceil(remainingMs / 1000);
  const fading = remainingMs < 700;

  return (
    <div
      className={`flex-1 w-full flex flex-col items-center justify-center text-center gap-4 rounded-3xl transition-opacity duration-700 ${
        fading ? "opacity-0" : "opacity-100 animate-pop-in"
      }`}
      style={{ backgroundImage: `radial-gradient(circle at 50% 40%, ${t.glow}, transparent 65%)` }}
    >
      <span className={`flex items-center justify-center rounded-full bg-white/10 border-2 border-current ${t.color} ${big ? "w-28 h-28" : "w-16 h-16"}`}>
        <Icon name={t.icon} size={big ? 64 : 36} strokeWidth={2.4} />
      </span>
      <h1 className={`font-black ${t.color} ${big ? "text-6xl" : "text-3xl"}`}>{t.title}</h1>
      <p className={`font-black text-white leading-none ${big ? "text-8xl" : "text-5xl"}`}>{description.headline}</p>
      {description.sub && <p className={`max-w-xl font-semibold text-slate-300 ${big ? "text-3xl" : "text-base"}`}>{description.sub}</p>}
      {personal && (
        <p className={`rounded-full bg-amber-400 px-4 py-2 font-black text-black ${big ? "text-2xl" : "text-base"}`}>
          {personal}
        </p>
      )}
      <span
        className={`flex items-center justify-center rounded-full border-4 border-white/20 font-black tabular-nums text-slate-200 ${
          big ? "w-20 h-20 text-4xl mt-4" : "w-12 h-12 text-xl mt-2"
        }`}
        aria-label={`Starting in ${left}`}
      >
        {left}
      </span>
    </div>
  );
}

/** The twist's label during its question and reveal. */
export function TwistBanner({ twist, text, big = false }: { twist: Twist; text: string; big?: boolean }) {
  const t = TWISTS[twist];
  return (
    <div
      className={`self-center rounded-full bg-white/10 border border-white/20 font-black ${t.color} ${
        big ? "px-6 py-2 text-2xl" : "px-3 py-1 text-sm"
      }`}
    >
      {text}
    </div>
  );
}
