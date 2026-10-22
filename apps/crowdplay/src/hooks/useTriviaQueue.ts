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
      .channel(`trivia-queue:${venueId}:${Math.random().toString(36).slice(2)}`)
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

// Rough game timings, for "starts in about N minutes": a question is ~35s
// plus the 8s reveal, the final screen stays 20s, and the next lobby
// counts down 90s once its players are in.
const SECONDS_PER_QUESTION = 43;
const FINAL_SECONDS = 20;
const LOBBY_SECONDS = 90;

/** About how many minutes until a queued game starts. */
export function minutesUntilGame(q: QueuedGame) {
  const total = q.o_current_total || 20;
  const fullGame = total * SECONDS_PER_QUESTION + FINAL_SECONDS + LOBBY_SECONDS;
  let current: number;
  if (q.o_current_phase === "final") current = FINAL_SECONDS + LOBBY_SECONDS;
  else if (!q.o_current_phase || q.o_current_phase === "lobby") current = fullGame + LOBBY_SECONDS;
  else current = Math.max(1, total - (q.o_current_question || 1) + 1) * SECONDS_PER_QUESTION + FINAL_SECONDS + LOBBY_SECONDS;
  const seconds = current + Math.max(0, q.o_rounds_to_wait - 1) * fullGame;
  return Math.max(1, Math.round(seconds / 60));
}

/**
 * "Starts in about 6 minutes" when we know where the current game is,
 * otherwise "Starts after this game" / "Starts after 2 more games".
 */
export function roundsToWaitLabel(rounds: number, q?: QueuedGame) {
  if (q?.o_current_phase) {
    const m = minutesUntilGame(q);
    return m <= 1 ? "Starts in about a minute" : `Starts in about ${m} minutes`;
  }
  return rounds <= 1 ? "Starts after this game" : `Starts after ${rounds} more games`;
}

/** Where the game on now is, e.g. "Question 7 of 20", for queued players. */
export function currentGameProgress(q: QueuedGame | undefined) {
  if (!q?.o_current_phase) return null;
  if (q.o_current_phase === "lobby") return "The current game hasn't started yet";
  if (q.o_current_phase === "final") return "The current game is wrapping up";
  return `The current game is on question ${q.o_current_question} of ${q.o_current_total || "?"}`;
}
