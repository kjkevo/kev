"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Player, Room } from "@/lib/types";

/**
 * Single source of truth for "what's happening in this room right now",
 * shared by both the host screen and every player's phone. Rides on
 * Postgres realtime changes to `rooms` and `players` — if a phone's
 * websocket drops (locked screen, bad wifi) and reconnects, the initial
 * select below re-syncs it rather than leaving it stuck on stale state.
 */
export function useRoomRealtime(code: string | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data: roomRow } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code!.toUpperCase())
        .maybeSingle();

      if (cancelled) return;
      if (!roomRow) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setRoom(roomRow);

      const { data: playerRows } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", roomRow.id)
        .order("score", { ascending: false });
      if (cancelled) return;
      setPlayers(playerRows ?? []);
      setLoading(false);

      const channel = supabase
        .channel(`room:${roomRow.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomRow.id}` },
          (payload) => {
            if (payload.eventType === "DELETE") return;
            setRoom(payload.new as Room);
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomRow.id}` },
          () => {
            // Score changes need a re-sort, so just refetch the (small) list
            // rather than trying to patch-and-resort by hand.
            supabase
              .from("players")
              .select("*")
              .eq("room_id", roomRow.id)
              .order("score", { ascending: false })
              .then(({ data }) => {
                if (!cancelled) setPlayers(data ?? []);
              });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const cleanupPromise = load();
    return () => {
      cancelled = true;
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [code]);

  return { room, players, loading, notFound };
}
