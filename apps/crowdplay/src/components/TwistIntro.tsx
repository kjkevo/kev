"use client";

import { useEffect, useState } from "react";
import { TWIST_INTRO_SECONDS, TWISTS, type Twist } from "@/lib/twists";

/**
 * The 7-second "here comes a twist" screen before a twist question: the
 * twist's icon, name and what it does, a countdown, then it fades out as
 * the question starts.
 */
export function TwistIntro({
  twist,
  description,
  personal,
  startedAt,
  big = false,
}: {
  twist: Twist;
  description: string;
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
      <p className={`uppercase tracking-[0.3em] font-bold text-slate-400 ${big ? "text-2xl" : "text-xs"}`}>Game twist</p>
      <div className={big ? "text-[10rem] leading-none" : "text-8xl leading-none"}>{t.icon}</div>
      <h1 className={`font-black ${t.color} ${big ? "text-7xl" : "text-4xl"}`}>{t.title}</h1>
      <p className={`max-w-xl font-semibold text-slate-100 ${big ? "text-3xl" : "text-lg"}`}>{description}</p>
      {personal && (
        <p className={`rounded-full bg-white/10 border border-white/20 px-4 py-2 font-black text-amber-300 ${big ? "text-2xl" : "text-base"}`}>
          {personal}
        </p>
      )}
      <p className={`tabular-nums text-slate-400 ${big ? "text-2xl mt-4" : "text-sm mt-2"}`}>Starting in {left}…</p>
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
