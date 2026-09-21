"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PublicQuestion } from "@/lib/types";

/**
 * Each room gets its own randomized, category-mixed question list at
 * creation time (see create_room). Two-step lookup — room_questions maps
 * (room, order_index) -> question_id, then questions_public gives the
 * answer-key-free content — rather than a PostgREST embed, since embedding
 * across a view without its own FK metadata isn't reliably supported.
 */
export function useCurrentQuestion(roomId: string | undefined, orderIndex: number | undefined) {
  const [question, setQuestion] = useState<PublicQuestion | null>(null);

  useEffect(() => {
    if (!roomId || orderIndex === undefined) {
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
  }, [roomId, orderIndex]);

  return question;
}
