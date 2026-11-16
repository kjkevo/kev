"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { deviceKey } from "@/lib/device";

/** Space ranks (migration 0120): one per game, reset a little each month. */
export type RankGame = "trivia" | "bingo" | "wild-match" | "drop-line";
export type MyRank = { label: string; tier: number; rp: number; stepRp: number; supernova: number | null; games: number };

export const RANK_NAMES = ["Spark", "Comet", "Star", "Nova", "Galaxy", "Supernova"];
/** Badge colors, Spark (0) to Supernova (5). */
export const RANK_STYLE = [
  "bg-orange-400/20 border-orange-300/60 text-orange-200",
  "bg-sky-400/20 border-sky-300/60 text-sky-200",
  "bg-yellow-400/20 border-yellow-300/60 text-yellow-200",
  "bg-fuchsia-400/20 border-fuchsia-300/60 text-fuchsia-200",
  "bg-violet-500/25 border-violet-300/70 text-violet-100",
  "bg-gradient-to-r from-rose-500/40 to-amber-400/40 border-amber-300 text-white",
];

/** Which game a page belongs to, from its path. */
export function rankGameFor(path: string | null): RankGame | null {
  if (!path) return null;
  if (path.startsWith("/bingo")) return "bingo";
  if (path.startsWith("/wild-match")) return "wild-match";
  if (path.startsWith("/drop-line")) return "drop-line";
  if (path.startsWith("/trivia") || path.startsWith("/play/")) return "trivia";
  return null;
}

/** The next rank up ("Comet I" after "Comet II", "Star III" after "Comet I"). */
export function nextRankLabel(rp: number): string | null {
  if (rp >= 1400) return null;
  const next = Math.floor(rp / 100) * 100 + 100;
  const tier = Math.min(4, Math.floor(next / 300));
  const step = ["III", "II", "I"][Math.min(2, Math.floor((next - tier * 300) / 100))];
  return `${RANK_NAMES[tier]} ${step}`;
}

export function useMyRank(game: RankGame | null) {
  const [rank, setRank] = useState<MyRank | null>(null);
  useEffect(() => {
    if (!game) return;
    let cancelled = false;
    const load = () =>
      supabase.rpc("get_my_rank", { p_device_key: deviceKey(), p_game: game }).then(({ data }) => {
        const r = data?.[0];
        if (cancelled || !r) return;
        setRank({ label: r.o_label, tier: r.o_tier, rp: r.o_rp, stepRp: r.o_step_rp, supernova: r.o_supernova, games: r.o_games });
      });
    load();
    window.addEventListener("slimpse:progress", load);
    return () => {
      cancelled = true;
      window.removeEventListener("slimpse:progress", load);
    };
  }, [game]);
  return rank;
}
