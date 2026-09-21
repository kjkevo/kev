"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { FeudPlayer, FeudRoom } from "@/lib/types";

/**
 * Feud's version of useRoomRealtime: one room by code, plus its players,
 * kept live via postgres_changes on feud_rooms/feud_players.
 */
export function useFeudRoomRealtime(code: string | null) {
  const [room, setRoom] = useState<FeudRoom | null>(null);
  const [players, setPlayers] = useState<FeudPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data: roomRow } = await supabase
        .from("feud_rooms")
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
        .from("feud_players")
        .select("*")
        .eq("room_id", roomRow.id)
        .order("joined_at", { ascending: true });
      if (cancelled) return;
      setPlayers(playerRows ?? []);
      setLoading(false);

      const channel = supabase
        .channel(`feud-room:${roomRow.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "feud_rooms", filter: `id=eq.${roomRow.id}` },
          (payload) => {
            if (payload.eventType === "DELETE") return;
            setRoom(payload.new as FeudRoom);
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "feud_players", filter: `room_id=eq.${roomRow.id}` },
          () => {
            supabase
              .from("feud_players")
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
