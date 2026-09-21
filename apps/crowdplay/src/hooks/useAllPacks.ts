"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { QuestionPack } from "@/lib/types";

/** The 8 categories rarely change — fetched once and looked up by id wherever a name is needed. */
export function useAllPacks() {
  const [packs, setPacks] = useState<Record<string, QuestionPack>>({});

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("question_packs")
      .select("*")
      .then(({ data }) => {
        if (cancelled || !data) return;
        setPacks(Object.fromEntries(data.map((p) => [p.id, p])));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return packs;
}
