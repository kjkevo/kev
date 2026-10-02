"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type RevealPick = {
  playerId: string;
  teamId: string;
  group: string | null; // null: didn't answer
  label: string | null;
  correct: boolean;
  teamCorrect: boolean;
};

export type QuestionReveal = { correctAnswer: string; picks: RevealPick[] };

/** Who picked what on the question just played, during its reveal. */
export function useQuestionReveal(roomId: string | undefined, phase: string | undefined, questionIndex: number | undefined) {
  const [reveal, setReveal] = useState<QuestionReveal | null>(null);

  useEffect(() => {
    setReveal(null);
    if (!roomId || phase !== "reveal") return;
    let cancelled = false;
    supabase.rpc("get_question_reveal", { p_room_id: roomId }).then(({ data }) => {
      if (cancelled || !data || data.length === 0) return;
      setReveal({
        correctAnswer: data[0].o_correct_answer,
        picks: data.map((r) => ({
          playerId: r.o_player_id,
          teamId: r.o_team_id,
          group: r.o_group,
          label: r.o_label,
          correct: r.o_correct,
          teamCorrect: r.o_team_correct,
        })),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [roomId, phase, questionIndex]);

  return reveal;
}
