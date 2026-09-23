"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { BingoRoom } from "@/lib/types";

/** Bingo's version of useActiveRoom: the most recent non-final bingo room. */
export function useActiveBingoRoom(venueId: string | null | undefined) {
  const [room, setRoom] = useState<BingoRoom | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    if (venueId === undefined) return; // venue still loading
    if (venueId === null) {
      setRoom(null);
      return;
    }
    let cancelled = false;

    const refresh = () =>
      supabase
        .from("bingo_rooms")
        .select("*")
        .eq("venue_id", venueId)
        .neq("phase", "final")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setRoom(data);
        });

    refresh();
    const channel = supabase
      .channel(`active-bingo-room-watch:${venueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bingo_rooms", filter: `venue_id=eq.${venueId}` }, refresh)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [venueId]);

  return room;
}
