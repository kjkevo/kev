"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { FeudRoom } from "@/lib/types";

/** Feud's version of useActiveRoom: the most recent non-final feud room. */
export function useActiveFeudRoom(venueId: string | null | undefined) {
  const [room, setRoom] = useState<FeudRoom | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    if (venueId === undefined) return; // venue still loading
    if (venueId === null) {
      setRoom(null);
      return;
    }
    let cancelled = false;

    const refresh = () =>
      supabase
        .from("feud_rooms")
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
      .channel(`active-feud-room-watch:${venueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "feud_rooms", filter: `venue_id=eq.${venueId}` }, refresh)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [venueId]);

  return room;
}
