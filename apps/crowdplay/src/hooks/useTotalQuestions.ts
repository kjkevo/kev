"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * room_questions is only populated once voting closes and the game
 * actually starts (see finalize_voting_and_start), so this reads 0 during
 * lobby/voting — callers should only display it once phase is past lobby.
 * Re-fetches whenever the room transitions phase, since that's the only
 * moment the row count can change (population happens exactly once).
 */
export function useTotalQuestions(roomId: string | undefined, phase: string | undefined) {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!roomId) {
      setTotal(0);
      return;
    }
    let cancelled = false;
    supabase
      .from("room_questions")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId)
      .then(({ count }) => {
        if (!cancelled) setTotal(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, phase]);

  return total;
}
