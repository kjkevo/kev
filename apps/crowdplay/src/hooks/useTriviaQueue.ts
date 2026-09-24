"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

export type QueuedGame = Database["public"]["Functions"]["trivia_queue"]["Returns"][number];

/**
 * The trivia games lined up behind the one on now at a venue (busy nights:
 * the next lobby opens while a game runs, and another if that one fills).
 * In play order; o_rounds_to_wait is how many games finish before each
 * starts. Refreshes on any room change at the venue and every 5 seconds
 * for the player counts.
 */
export function useTriviaQueue(venueId: string | null | undefined) {
  const [queue, setQueue] = useState<QueuedGame[]>([]);

  useEffect(() => {
    if (!venueId) {
      setQueue([]);
      return;
    }
    let cancelled = false;
    const refresh = () =>
      supabase.rpc("trivia_queue", { p_venue_id: venueId }).then(({ data }) => {
        if (!cancelled && data) setQueue(data);
      });

    refresh();
    const timer = setInterval(refresh, 5000);
    const channel = supabase
      .channel(`trivia-queue:${venueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `venue_id=eq.${venueId}` }, refresh)
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [venueId]);

  return queue;
}

/** "Starts after this game" / "Starts after 2 more games". */
export function roundsToWaitLabel(rounds: number) {
  return rounds <= 1 ? "Starts after this game" : `Starts after ${rounds} more games`;
}

/** Where the game on now is, e.g. "Question 7 of 20", for queued players. */
export function currentGameProgress(q: QueuedGame | undefined) {
  if (!q?.o_current_phase) return null;
  if (q.o_current_phase === "lobby") return "The current game hasn't started yet";
  if (q.o_current_phase === "final") return "The current game is wrapping up";
  return `The current game is on question ${q.o_current_question} of ${q.o_current_total || "?"}`;
}
