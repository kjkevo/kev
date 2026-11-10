"use client";

import { useState } from "react";
import { AccountSheet } from "@/components/AccountSheet";
import { levelFraction, useProgress } from "@/lib/progress";

/** Home screen: your level, XP bar, streak, next character unlock and the save/sign-in link. */
export function ProgressCard() {
  const { progress: p } = useProgress();
  const [sheet, setSheet] = useState<null | "save" | "signin">(null);
  if (!p) return null;

  return (
    <div className="w-full rounded-3xl bg-white/[0.06] border border-white/15 px-4 py-3 text-left">
      {p.games === 0 ? (
        <p className="text-sm text-slate-300 text-center">
          Play a game to start leveling up and unlock new characters.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-amber-400 text-black text-sm font-black px-3 py-0.5">Level {p.level}</span>
            {p.streak > 0 && (
              <span className="text-sm font-black text-orange-300">
                🔥 {p.streak}-day streak
              </span>
            )}
          </div>
          <div className="mt-2 h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${levelFraction(p) * 100}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>
              {p.xp - p.levelXp} / {p.nextLevelXp - p.levelXp} XP
            </span>
            {p.nextUnlock && (
              <span>
                Level {p.nextUnlock.level}: <span className="text-amber-300 font-bold">{p.nextUnlock.name}</span>
              </span>
            )}
          </div>
          {p.streak > 0 && !p.playedToday && (
            <p className="mt-2 text-xs font-bold text-orange-300">Play today to keep your streak going!</p>
          )}
        </>
      )}

      <div className="mt-2 pt-2 border-t border-white/10 text-center text-xs">
        {p.saved ? (
          <span className="text-slate-400">✓ Saved to {p.email}</span>
        ) : p.games > 0 ? (
          <>
            <button type="button" onClick={() => setSheet("save")} className="font-bold text-amber-300">
              Save your progress ›
            </button>
            <span className="block text-slate-500">Not saved: resets after 4 hours away</span>
          </>
        ) : (
          <button type="button" onClick={() => setSheet("signin")} className="text-slate-400 underline">
            Already saved? Sign in
          </button>
        )}
      </div>

      {sheet && <AccountSheet signIn={sheet === "signin"} onClose={() => setSheet(null)} />}
    </div>
  );
}
