"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { FeudRoom } from "@/lib/types";

/** Feud's version of useActiveRoom: the most recent non-final feud room. */
export function useActiveFeudRoom() {
  const [room, setRoom] = useState<FeudRoom | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    let cancelled = false;

    const refresh = () =>
      supabase
        .from("feud_rooms")
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
      .channel("active-feud-room-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "feud_rooms" }, refresh)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return room;
}
