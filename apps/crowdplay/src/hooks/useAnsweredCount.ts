"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Live "N have answered" count for the current question, shared by host and player screens. */
export function useAnsweredCount(questionId: string | undefined) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!questionId) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const refresh = () =>
      supabase
        .from("answers")
        .select("id", { count: "exact", head: true })
        .eq("question_id", questionId)
        .then(({ count }) => {
          if (!cancelled) setCount(count ?? 0);
        });
    refresh();
    const channel = supabase
      .channel(`answers:${questionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "answers", filter: `question_id=eq.${questionId}` },
        () => refresh()
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [questionId]);

  return count;
}
