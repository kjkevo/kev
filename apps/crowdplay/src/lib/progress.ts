"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { deviceKey } from "@/lib/device";

export type Progress = {
  level: number;
  xp: number;
  levelXp: number;
  nextLevelXp: number;
  streak: number;
  bestStreak: number;
  playedToday: boolean;
  games: number;
  wins: number;
  saved: boolean;
  email: string | null;
  nextUnlock: { id: string; name: string; level: number } | null;
};

/** Tell every progress/character view on the page to reload (after a game, a save, a purchase). */
export function announceProgress() {
  try {
    window.dispatchEvent(new Event("slimpse:progress"));
  } catch {
    // not in a browser
  }
}

/** This player's level, streak and next character unlock. */
export function useProgress() {
  const [progress, setProgress] = useState<Progress | null>(null);

  const refresh = useCallback(() => {
    supabase.rpc("get_my_progress", { p_device_key: deviceKey() }).then(({ data }) => {
      const r = data?.[0];
      if (!r) return;
      setProgress({
        level: r.o_level,
        xp: r.o_xp,
        levelXp: r.o_level_xp,
        nextLevelXp: r.o_next_level_xp,
        streak: r.o_streak,
        bestStreak: r.o_best_streak,
        playedToday: r.o_played_today,
        games: r.o_games,
        wins: r.o_wins,
        saved: r.o_saved,
        email: r.o_email,
        nextUnlock:
          r.o_next_unlock_id && r.o_next_unlock_name && r.o_next_unlock_level
            ? { id: r.o_next_unlock_id, name: r.o_next_unlock_name, level: r.o_next_unlock_level }
            : null,
      });
    });
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("slimpse:progress", refresh);
    return () => window.removeEventListener("slimpse:progress", refresh);
  }, [refresh]);

  return { progress, refresh };
}

/** Share of the way from this level to the next, 0..1. */
export function levelFraction(p: { xp: number; levelXp: number; nextLevelXp: number }) {
  const span = p.nextLevelXp - p.levelXp;
  return span > 0 ? Math.min(1, Math.max(0, (p.xp - p.levelXp) / span)) : 1;
}

/**
 * Save this phone's progress to the signed-in email. Runs after the email code
 * is verified (or the email link is opened on this phone).
 */
export async function linkThisPhone() {
  const { data, error } = await supabase.rpc("link_account", { p_device_key: deviceKey() });
  if (error) throw error;
  announceProgress();
  return data?.[0] ?? null;
}

const PROMPT_KEY = "slimpse_save_prompt_dismissed";

/** "Maybe later" on the save prompt: hide it until the player has something new to lose. */
export function dismissSavePrompt(games: number) {
  try {
    localStorage.setItem(PROMPT_KEY, String(games));
  } catch {
    // storage blocked: it just shows again
  }
}

/**
 * Should the "Save your progress" card show? After the first game, then again
 * after every 3 more games, or on a level-up / new character / 3+ day streak.
 */
export function shouldPromptSave(games: number, bigMoment: boolean) {
  let dismissedAt = -1;
  try {
    dismissedAt = Number(localStorage.getItem(PROMPT_KEY) ?? -1);
  } catch {
    // storage blocked
  }
  if (dismissedAt < 0) return games >= 1;
  return bigMoment || games - dismissedAt >= 3;
}
