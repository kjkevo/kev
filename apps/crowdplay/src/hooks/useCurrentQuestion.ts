"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PublicQuestion } from "@/lib/types";

/**
 * Each room gets its own randomized, category-mixed question list, but only
 * once voting closes and finalize_voting_and_start populates room_questions
 * — during 'lobby' there's nothing to find yet. current_question_index is
 * 0 both during lobby (the column default) and for the actual first
 * question, so roomId+orderIndex alone don't change across that
 * transition — without `phase` in the dependency array, the lobby-time
 * "nothing found" result would stick forever, showing a blank screen
 * instead of ever fetching the first question. `phase` is only taken to
 * force a refetch on that transition, not otherwise used.
 */
export function useCurrentQuestion(
  roomId: string | undefined,
  orderIndex: number | undefined,
  phase: string | undefined
) {
  const [question, setQuestion] = useState<PublicQuestion | null>(null);

  useEffect(() => {
    if (!roomId || orderIndex === undefined || phase === "lobby") {
      setQuestion(null);
      return;
    }
    let cancelled = false;

    supabase
      .from("room_questions")
      .select("question_id")
      .eq("room_id", roomId)
      .eq("order_index", orderIndex)
      .maybeSingle()
      .then(({ data: mapping }) => {
        if (cancelled || !mapping) {
          if (!cancelled) setQuestion(null);
          return;
        }
        supabase
          .from("questions_public")
          .select("*")
          .eq("id", mapping.question_id)
          .maybeSingle()
          .then(({ data }) => {
            if (!cancelled) setQuestion(data as PublicQuestion | null);
          });
      });

    return () => {
      cancelled = true;
    };
  }, [roomId, orderIndex, phase]);

  return question;
}
