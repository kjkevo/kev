"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Room } from "@/lib/types";

/**
 * Finds "the game" for a venue without a room code: the venue's most
 * recently created room that hasn't finished (each venue has its own).
 * Subscribes to that venue's room changes so a freshly-created room, or the
 * current one finishing, updates this screen live. Pass undefined while the
 * venue is still being looked up.
 */
export function useActiveRoom(venueId: string | null | undefined) {
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
        .eq("queued", false) // lobbies waiting their turn aren't "the game" yet
        .neq("phase", "final")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setRoom(data);
        });

    refresh();
    const channel = supabase
      .channel(`active-room-watch:${venueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `venue_id=eq.${venueId}` }, refresh)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [venueId]);

  return room;
}
