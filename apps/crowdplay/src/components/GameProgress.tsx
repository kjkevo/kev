"use client";

import { useEffect, useState } from "react";
import { AccountSheet } from "@/components/AccountSheet";
import { Avatar } from "@/components/Avatar";
import { supabase } from "@/lib/supabase";
import { deviceKey } from "@/lib/device";
import { announceProgress, dismissSavePrompt, levelFraction, shouldPromptSave } from "@/lib/progress";

type Earned = {
  xpGained: number;
  correct: number;
  level: number;
  levelBefore: number;
  xp: number;
  levelXp: number;
  nextLevelXp: number;
  streak: number;
  games: number;
  saved: boolean;
  unlocked: { id: string; name: string }[];
};

/**
 * Results screen: the XP this game earned, the level bar, a level-up or new
 * character, the streak, and (for guests) "Save your progress".
 */
export function GameProgress({
  roomId,
  avatars,
}: {
  roomId: string;
  avatars: Record<string, { emoji: string | null; imageUrl: string | null }>;
}) {
  const [earned, setEarned] = useState<Earned | null>(null);
  const [sheet, setSheet] = useState(false);
  const [hidePrompt, setHidePrompt] = useState(false);
  const [fill, setFill] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    // The game's XP is written the moment it ends; retry briefly in case we got here first.
    const load = () => {
      supabase.rpc("get_game_progress", { p_room_id: roomId, p_device_key: deviceKey() }).then(({ data }) => {
        if (cancelled) return;
        const r = data?.[0];
        if (!r) {
          if (++tries < 4) setTimeout(load, 1500);
          return;
        }
        const e: Earned = {
          xpGained: r.o_xp_gained,
          correct: r.o_correct,
          level: r.o_level,
          levelBefore: r.o_level_before,
          xp: r.o_xp,
          levelXp: r.o_level_xp,
          nextLevelXp: r.o_next_level_xp,
          streak: r.o_streak,
          games: r.o_games,
          saved: r.o_saved,
          unlocked: r.o_unlocked_ids.map((id, i) => ({ id, name: r.o_unlocked_names[i] ?? id })),
        };
        setEarned(e);
        setTimeout(() => setFill(levelFraction(e)), 300);
        announceProgress();
      });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (!earned) return null;
  const leveledUp = earned.level > earned.levelBefore;
  const bigMoment = leveledUp || earned.unlocked.length > 0 || earned.streak >= 3;
  const showSave = !earned.saved && !hidePrompt && shouldPromptSave(earned.games, bigMoment);

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-black text-amber-300">+{earned.xpGained} XP</span>
          <span className="text-sm font-bold">{leveledUp ? `Level up! Level ${earned.level}` : `Level ${earned.level}`}</span>
        </div>
        <div className="mt-2 h-2.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-amber-400 transition-all duration-1000" style={{ width: `${fill * 100}%` }} />
        </div>
        {earned.streak > 0 && (
          <p className="mt-2 text-sm font-black text-orange-300">
            🔥 {earned.streak}-day streak{earned.streak === 1 ? ". Come back tomorrow!" : ""}
          </p>
        )}
      </div>

      {earned.unlocked.map((u) => (
        <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-amber-400/15 border border-amber-400/50 px-4 py-2.5 text-left animate-pop-in">
          <Avatar emoji={avatars[u.id]?.emoji ?? null} imageUrl={avatars[u.id]?.imageUrl ?? null} size={52} />
          <span>
            <span className="block text-xs font-bold uppercase tracking-widest text-amber-300">New character</span>
            <span className="block text-lg font-black">{u.name} unlocked!</span>
          </span>
        </div>
      ))}

      {showSave && (
        <div className="rounded-2xl bg-indigo-500/20 border border-indigo-400/50 px-4 py-3">
          <p className="font-black">Save your progress</p>
          <p className="text-sm text-slate-300">Unsaved progress resets after 4 hours away. Keep it with just your email, no password.</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                dismissSavePrompt(earned.games);
                setHidePrompt(true);
              }}
              className="flex-1 rounded-xl bg-white/10 py-2 text-sm font-bold"
            >
              Maybe later
            </button>
            <button type="button" onClick={() => setSheet(true)} className="flex-1 rounded-xl bg-amber-400 text-black py-2 text-sm font-black">
              Save
            </button>
          </div>
        </div>
      )}

      {sheet && (
        <AccountSheet
          onClose={() => {
            setSheet(false);
            setHidePrompt(true);
          }}
        />
      )}
    </div>
  );
}
