"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { coalesce } from "@/lib/coalesce";

export type Fog = { id: string; from_team: string; to_team: string; thrown_at: string };

/**
 * Fogs thrown on a sabotage question, live (realtime plus a 1-second poll,
 * since a fog only lasts 3 seconds). Pass no question to turn it off.
 */
export function useFogs(roomId: string | undefined, questionId: string | undefined) {
  const [fogs, setFogs] = useState<Fog[]>([]);

  useEffect(() => {
    setFogs([]);
    if (!roomId || !questionId) return;
    let cancelled = false;
    const load = coalesce(async () => {
      const { data } = await supabase
        .from("trivia_fogs")
        .select("id, from_team, to_team, thrown_at")
        .eq("room_id", roomId)
        .eq("question_id", questionId);
      if (!cancelled && data) setFogs(data as Fog[]);
    }, 300);
    load();
    const channel = supabase
      .channel(`fogs:${questionId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trivia_fogs", filter: `room_id=eq.${roomId}` }, load)
      .subscribe();
    const poll = setInterval(load, 1000);
    return () => {
      cancelled = true;
      load.stop();
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [roomId, questionId]);

  return fogs;
}
