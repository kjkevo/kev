"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Live vote counts for the 2 candidate categories during a room's lobby/voting window. */
export function useCategoryVoteTally(roomId: string | undefined) {
  const [tally, setTally] = useState({ a: 0, b: 0 });

  useEffect(() => {
    if (!roomId) {
      setTally({ a: 0, b: 0 });
      return;
    }
    let cancelled = false;
    const refresh = () =>
      supabase
        .from("category_votes")
        .select("choice")
        .eq("room_id", roomId)
        .then(({ data }) => {
          if (cancelled || !data) return;
          const a = data.filter((v) => v.choice === 0).length;
          const b = data.filter((v) => v.choice === 1).length;
          setTally({ a, b });
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
