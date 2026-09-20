"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PublicQuestion } from "@/lib/types";

export function useCurrentQuestion(packId: string | undefined, orderIndex: number | undefined) {
  const [question, setQuestion] = useState<PublicQuestion | null>(null);

  useEffect(() => {
    if (!packId || orderIndex === undefined) {
      setQuestion(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("questions_public")
      .select("*")
      .eq("pack_id", packId)
      .eq("order_index", orderIndex)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setQuestion(data as PublicQuestion | null);
      });
    return () => {
      cancelled = true;
    };
  }, [packId, orderIndex]);

  return question;
}
