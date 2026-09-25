"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type TriviaChampion = {
  nickname: string;
  emoji: string | null;
  imageUrl: string | null;
  streak: number;
};

/** This month's featured champion at a venue (3+ trivia wins in a row), refreshed every minute. */
export function useTriviaChampion(venue: string | null) {
  const [champion, setChampion] = useState<TriviaChampion | null>(null);
  useEffect(() => {
    if (!venue) return;
    let cancelled = false;
    const load = () =>
      supabase.rpc("get_trivia_champion", { p_venue: venue }).then(({ data }) => {
        if (cancelled) return;
        const row = data?.[0];
        setChampion(
          row ? { nickname: row.o_nickname, emoji: row.o_emoji, imageUrl: row.o_image_url, streak: row.o_streak } : null
        );
      });
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [venue]);
  return champion;
}
