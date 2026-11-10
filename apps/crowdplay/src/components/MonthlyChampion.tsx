"use client";

import { useEffect, useState } from "react";
import { ChestUp } from "@/components/ChestUp";
import { supabase } from "@/lib/supabase";
import { usePlayerVenue } from "@/lib/venue";

type Champion = { nickname: string; emoji: string | null; imageUrl: string | null; month: string };

// Stand-in until someone wins a game this month.
const PLACEHOLDER = { nickname: "Quizzly Bear", emoji: null, imageUrl: "/avatars/stone-golem-256.png" };

/**
 * Champion of the month on the main menu: the real player with the most
 * trivia wins at this bar this month (get_monthly_champion), chest up with
 * their name.
 */
export function MonthlyChampion() {
  const venue = usePlayerVenue();
  const [champ, setChamp] = useState<Champion | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc("get_monthly_champion", { p_venue: venue ?? "main" }).then(({ data }) => {
      if (cancelled) return;
      const r = data?.[0];
      setChamp(r ? { nickname: r.o_nickname, emoji: r.o_emoji, imageUrl: r.o_image_url, month: r.o_month } : null);
    });
    return () => {
      cancelled = true;
    };
  }, [venue]);

  if (champ === undefined) return null;
  const month = champ?.month ?? new Date().toLocaleString("en-US", { month: "long" });
  const shown = champ ?? PLACEHOLDER;
  return (
    <div className="w-full rounded-3xl bg-gradient-to-b from-amber-400/20 to-amber-400/5 border border-amber-400/40 px-4 py-3 flex flex-col items-center gap-2">
      <p className="text-[11px] font-bold uppercase tracking-widest text-amber-300">👑 {month} Champion</p>
      <ChestUp imageUrl={shown.imageUrl} emoji={shown.emoji} name={shown.nickname} width={96} highlight />
    </div>
  );
}
