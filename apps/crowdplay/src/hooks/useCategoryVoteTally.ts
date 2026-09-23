"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Live vote counts per candidate category (pack id) during a room's lobby/voting window. */
export function useCategoryVoteTally(roomId: string | undefined) {
  const [tally, setTally] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!roomId) {
      setTally({});
      return;
    }
    let cancelled = false;
    const refresh = () =>
      supabase
        .from("category_votes")
        .select("choice_pack_id")
        .eq("room_id", roomId)
        .then(({ data }) => {
          if (cancelled || !data) return;
          const next: Record<string, number> = {};
          for (const row of data) {
            if (!row.choice_pack_id) continue;
            next[row.choice_pack_id] = (next[row.choice_pack_id] ?? 0) + 1;
          }
          setTally(next);
        });
    refresh();
    const channel = supabase
      .channel(`votes:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "category_votes", filter: `room_id=eq.${roomId}` },
        () => refresh()
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return tally;
}
