"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Live "who voted for what" for the current question. `choice_index` is
 * meaningless as a correctness signal in team mode (it's never scored per
 * vote), so exposing it live is safe -- only the eventual team majority and
 * whether that was right stays hidden until the final recap.
 */
export function useQuestionVotes(questionId: string | undefined) {
  const [votes, setVotes] = useState<Record<string, number>>({}); // player_id -> choice_index

  useEffect(() => {
    if (!questionId) {
      setVotes({});
      return;
    }
    let cancelled = false;

    const refresh = () =>
      supabase
        .from("answers")
        .select("player_id, choice_index")
        .eq("question_id", questionId)
        .then(({ data }) => {
          if (cancelled || !data) return;
          const next: Record<string, number> = {};
          for (const row of data) next[row.player_id] = row.choice_index;
          setVotes(next);
        });

    refresh();
    const channel = supabase
      .channel(`votes:${questionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "answers", filter: `question_id=eq.${questionId}` },
        refresh
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [questionId]);

  return votes;
}
