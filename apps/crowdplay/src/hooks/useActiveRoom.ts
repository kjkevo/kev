"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Room } from "@/lib/types";

/**
 * Finds "the game" for a venue without a room code: the venue's most
 * recently created room of that kind (team or solo) that hasn't finished,
 * which is the one open to join (several can run at once on a busy night).
 * Subscribes to that venue's room changes so a freshly-created room, or the
 * current one finishing, updates this screen live. Pass undefined while the
 * venue is still being looked up.
 */
export function useActiveRoom(
  venueId: string | null | undefined,
  mode: "team" | "solo" = "team",
  /** The venue TV: several games can run at once, so show one being played
   * (the newest) before the open lobby. */
  preferInProgress = false
) {
  const [room, setRoom] = useState<Room | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    if (venueId === undefined) return; // venue still loading
    if (venueId === null) {
      setRoom(null);
      return;
    }
    let cancelled = false;

    const refresh = () =>
      supabase
        .from("rooms")
        .select("*")
        .eq("venue_id", venueId)
        .eq("mode", mode)
        .eq("queued", false) // lobbies waiting their turn aren't "the game" yet
        .neq("phase", "final")
        .order("created_at", { ascending: false })
        .limit(6)
        .then(({ data }) => {
          if (cancelled) return;
          const rows = data ?? [];
          const playing = preferInProgress ? rows.find((r) => r.phase !== "lobby") : undefined;
          setRoom(playing ?? rows[0] ?? null);
        });

    refresh();
    const channel = supabase
      .channel(`active-room-watch:${venueId}:${mode}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `venue_id=eq.${venueId}` }, refresh)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [venueId, mode, preferInProgress]);

  return room;
}
