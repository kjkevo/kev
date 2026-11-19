"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { RANK_STYLE } from "@/lib/ranks";
import { haptics } from "@/lib/haptics";

/** Full-screen "Rank up!" when a game moves you to a new rank (Spark III to Comet I). */
export function RankUp({
  from,
  to,
  fromTier,
  toTier,
  onClose,
}: {
  from: string;
  to: string;
  fromTier: number;
  toTier: number;
  onClose: () => void;
}) {
  const [showNew, setShowNew] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setShowNew(true);
      haptics.correct();
    }, 900);
    return () => clearTimeout(t);
  }, []);
  const bigJump = toTier > fromTier;

  return (
    <div
      role="dialog"
      aria-label="Rank up"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-indigo-950 via-purple-950 to-black px-6 text-center text-white"
    >
      <div className="text-amber-300 animate-pop-in">
        <Icon name={bigJump ? "crown" : "star"} size={72} />
      </div>
      <h2 className="text-5xl font-black">Rank up!</h2>
      <div className="flex flex-col items-center gap-3">
        <span className={`rounded-full border-2 px-6 py-2 text-2xl font-black opacity-70 ${RANK_STYLE[fromTier] ?? RANK_STYLE[0]}`}>{from}</span>
        <Icon name="down" size={40} className="text-slate-300" />
        <span
          className={`rounded-full border-4 px-8 py-3 text-4xl font-black transition-all duration-500 ${RANK_STYLE[toTier] ?? RANK_STYLE[0]} ${
            showNew ? "opacity-100 scale-100 animate-pop-in" : "opacity-0 scale-50"
          }`}
        >
          {to}
        </span>
      </div>
      <p className={`text-2xl font-bold text-slate-200 transition-opacity duration-500 ${showNew ? "opacity-100" : "opacity-0"}`}>
        {bigJump ? "New rank!" : "Keep going!"}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="w-full max-w-xs rounded-2xl bg-amber-400 py-4 text-2xl font-black text-black active:scale-95 transition"
      >
        Nice!
      </button>
    </div>
  );
}
