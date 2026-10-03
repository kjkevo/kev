"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { EmotePlay } from "@/components/EmoteCharacter";

/**
 * Emotes are shared live with everyone in the game (nothing is saved):
 * `plays[playerId]` changes whenever that player emotes, and `send` plays
 * one for you and tells everyone else.
 */
export function useRoomEmotes(roomId: string | undefined, myPlayerId: string | undefined) {
  const [plays, setPlays] = useState<Record<string, EmotePlay>>({});
  const channel = useRef<RealtimeChannel | null>(null);

  const bump = useCallback((playerId: string, emoteId: string) => {
    setPlays((prev) => ({ ...prev, [playerId]: { emoteId, n: (prev[playerId]?.n ?? 0) + 1 } }));
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const ch = supabase
      .channel(`emotes:${roomId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "emote" }, ({ payload }) => {
        const p = payload as { playerId?: string; emoteId?: string };
        if (p.playerId && p.emoteId) bump(p.playerId, p.emoteId);
      })
      .subscribe();
    channel.current = ch;
    return () => {
      channel.current = null;
      supabase.removeChannel(ch);
    };
  }, [roomId, bump]);

  const send = useCallback(
    (emoteId: string) => {
      if (!myPlayerId) return;
      bump(myPlayerId, emoteId);
      channel.current?.send({ type: "broadcast", event: "emote", payload: { playerId: myPlayerId, emoteId } });
    },
    [myPlayerId, bump]
  );

  return { plays, send };
}
