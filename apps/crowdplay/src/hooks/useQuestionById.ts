"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** A question's public fields (no answer), e.g. the sudden death question. */
export function useQuestionById(questionId: string | null | undefined) {
  const [prompt, setPrompt] = useState<string | null>(null);
  useEffect(() => {
    if (!questionId) {
      setPrompt(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("questions_public")
      .select("prompt")
      .eq("id", questionId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setPrompt((data as { prompt: string } | null)?.prompt ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [questionId]);
  return prompt;
}
