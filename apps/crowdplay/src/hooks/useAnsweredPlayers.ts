"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Who has locked in an answer on this question (ids only, never the
 * answer itself), live, so every phone can show who's still thinking.
 */
export function useAnsweredPlayers(questionId: string | undefined) {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setIds(new Set());
    if (!questionId) return;
    let cancelled = false;
    const refresh = () =>
      supabase
        .from("answers")
        .select("player_id")
        .eq("question_id", questionId)
        .then(({ data }) => {
          if (!cancelled && data) setIds(new Set(data.map((r) => r.player_id as string)));
        });
    refresh();
    const channel = supabase
      .channel(`answered:${questionId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "answers", filter: `question_id=eq.${questionId}` },
        (payload) => {
          const id = (payload.new as { player_id?: string }).player_id;
          if (id) setIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
        }
      )
      .subscribe();
    // Safety net if the live connection drops.
    const poll = setInterval(refresh, 4000);
    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [questionId]);

  return ids;
}
