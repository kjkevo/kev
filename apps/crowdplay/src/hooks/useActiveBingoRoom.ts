"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { BingoRoom } from "@/lib/types";

/** Bingo's version of useActiveRoom: the most recent non-final bingo room. */
export function useActiveBingoRoom() {
  const [room, setRoom] = useState<BingoRoom | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    let cancelled = false;

    const refresh = () =>
      supabase
        .from("bingo_rooms")
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
      .channel("active-bingo-room-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "bingo_rooms" }, refresh)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return room;
}
