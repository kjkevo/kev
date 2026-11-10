"use client";

import { levelFraction, useProgress } from "@/lib/progress";

/**
 * The player's level and total XP. "bar" adds a thin progress bar to the
 * next level (Trivia page); the plain chip fits next to the Solo/team tag in
 * the lobby.
 */
export function LevelChip({ bar = false }: { bar?: boolean }) {
  const { progress: p } = useProgress();
  if (!p) return null;
  const chip = (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 border border-amber-400/40 px-2.5 py-0.5 text-xs font-bold text-amber-300 whitespace-nowrap">
      <span className="rounded-full bg-amber-400 text-black px-1.5 leading-4 font-black">Lv {p.level}</span>
      {p.xp.toLocaleString()} XP
    </span>
  );
  if (!bar) return chip;
  return (
    <div className="flex flex-col items-center gap-1">
      {chip}
      <div className="w-32 h-1.5 rounded-full bg-white/10 overflow-hidden" title={`${p.nextLevelXp - p.xp} XP to Level ${p.level + 1}`}>
        <div className="h-full rounded-full bg-amber-400" style={{ width: `${levelFraction(p) * 100}%` }} />
      </div>
    </div>
  );
}
