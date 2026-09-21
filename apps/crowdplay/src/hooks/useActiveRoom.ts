"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Room } from "@/lib/types";

/**
 * Finds "the game" for the venue without a room code: the most recently
 * created room that hasn't finished. Single-venue MVP assumption — one
 * Supabase project serves one bar, so there's no ambiguity about whose
 * room this is. Subscribes to all room changes so a freshly-created room,
 * or the current one finishing, updates this screen live.
 */
export function useActiveRoom() {
  const [room, setRoom] = useState<Room | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    let cancelled = false;

    const refresh = () =>
      supabase
        .from("rooms")
        .select("*")
        .neq("phase", "final")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setRoom(data);
        });

    refresh();
    const channel = supabase
      .channel("active-room-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, refresh)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return room;
}
