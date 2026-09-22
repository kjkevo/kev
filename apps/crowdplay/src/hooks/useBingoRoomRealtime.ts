"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { BingoPlayer, BingoRoom } from "@/lib/types";

/**
 * Bingo's version of useRoomRealtime: one room by code, plus its players,
 * kept live via postgres_changes on bingo_rooms/bingo_players.
 */
export function useBingoRoomRealtime(code: string | null) {
  const [room, setRoom] = useState<BingoRoom | null>(null);
  const [players, setPlayers] = useState<BingoPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data: roomRow } = await supabase
        .from("bingo_rooms")
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
        .from("bingo_players")
        .select("*")
        .eq("room_id", roomRow.id)
        .order("joined_at", { ascending: true });
      if (cancelled) return;
      setPlayers(playerRows ?? []);
      setLoading(false);

      const channel = supabase
        .channel(`bingo-room:${roomRow.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bingo_rooms", filter: `id=eq.${roomRow.id}` },
          (payload) => {
            if (payload.eventType === "DELETE") return;
            setRoom(payload.new as BingoRoom);
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bingo_players", filter: `room_id=eq.${roomRow.id}` },
          () => {
            supabase
              .from("bingo_players")
              .select("*")
              .eq("room_id", roomRow.id)
              .order("joined_at", { ascending: true })
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
