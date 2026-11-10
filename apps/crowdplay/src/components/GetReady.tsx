"use client";

import { useEffect, useState } from "react";
import { CharacterBuddy } from "@/components/CharacterBuddy";

/**
 * The character under the Get Ready countdown, sized to fill the rest of a
 * phone held upright: about 45% of the screen height (never wider than 80%
 * of the screen), so countdown + character fill the screen together.
 */
export function GetReadyCharacter({ emoji, imageUrl }: { emoji?: string | null; imageUrl?: string | null }) {
  const [size, setSize] = useState(240);
  useEffect(() => {
    const fit = () => setSize(Math.round(Math.max(140, Math.min(window.innerHeight * 0.45, window.innerWidth * 0.8, 460))));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return <CharacterBuddy emoji={emoji} imageUrl={imageUrl} mood="hop" size={size} />;
}

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
      {/* With no subtitle the title is the headline ("Get Ready"). */}
      {subtitle ? (
        <p className={`uppercase tracking-widest text-slate-400 ${big ? "text-2xl" : "text-sm"}`}>{title}</p>
      ) : (
        <p className={`font-black text-amber-400 ${big ? "text-7xl" : "text-5xl"}`}>{title}</p>
      )}
      {subtitle && <p className={`font-black text-amber-400 ${big ? "text-6xl" : "text-3xl"}`}>{subtitle}</p>}
      <div
        key={seconds}
        className={`rounded-full bg-white/10 border-4 border-amber-400 flex items-center justify-center font-black tabular-nums animate-pop-in ${
          big ? "w-48 h-48 text-8xl" : "w-32 h-32 text-7xl"
        }`}
      >
        {Math.max(1, seconds)}
      </div>
    </div>
  );
}
