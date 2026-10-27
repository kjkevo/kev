"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { supabase } from "@/lib/supabase";
import { usePlayerVenue } from "@/lib/venue";

type Champion = { nickname: string; emoji: string | null; imageUrl: string | null; wins: number; games: number; month: string };

/**
 * Champion of the month on the main menu: the real player with the most
 * trivia wins at this bar this month (get_monthly_champion). Shows an open
 * "be the first" spot until someone wins.
 */
export function MonthlyChampion() {
  const venue = usePlayerVenue();
  const [champ, setChamp] = useState<Champion | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc("get_monthly_champion", { p_venue: venue ?? "main" }).then(({ data }) => {
      if (cancelled) return;
      const r = data?.[0];
      setChamp(
        r
          ? { nickname: r.o_nickname, emoji: r.o_emoji, imageUrl: r.o_image_url, wins: r.o_wins, games: r.o_games, month: r.o_month }
          : null
      );
    });
    return () => {
      cancelled = true;
    };
  }, [venue]);

  if (champ === undefined) return null;
  const month = champ?.month ?? new Date().toLocaleString("en-US", { month: "long" });
  return (
    <div className="w-full rounded-3xl bg-gradient-to-b from-amber-400/20 to-amber-400/5 border border-amber-400/40 px-4 py-3 flex items-center gap-3 text-left">
      {champ ? (
        <>
          <div className="shrink-0">
            <Avatar emoji={champ.emoji} imageUrl={champ.imageUrl} size={64} variant="full" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-300">{month} Champion</p>
            <p className="text-xl font-black truncate">{champ.nickname}</p>
            <p className="text-sm text-slate-300">
              {champ.wins} trivia {champ.wins === 1 ? "win" : "wins"} this month
            </p>
          </div>
        </>
      ) : (
        <div className="flex-1 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-300">{month} Champion</p>
          <p className="text-base font-black">Nobody yet. Win a game to take the crown!</p>
        </div>
      )}
    </div>
  );
}
