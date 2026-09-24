"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type TeamProgress = { id: string; name: string; locked: boolean; voted: number; members: number };

/**
 * Every team's status on the current question -- locked in, or how many
 * members have voted -- without anyone's answers. Refetches on any vote
 * (realtime on answers) with a slow poll as a backstop.
 */
export function useTeamProgress(roomId: string | undefined, questionId: string | undefined) {
  const [teams, setTeams] = useState<TeamProgress[]>([]);

  useEffect(() => {
    if (!roomId || !questionId) {
      setTeams([]);
      return;
    }
    let cancelled = false;
    const load = () =>
      supabase.rpc("get_team_progress", { p_room_id: roomId, p_question_id: questionId }).then(({ data }) => {
        if (cancelled || !data) return;
        setTeams(data.map((t) => ({ id: t.o_team_id, name: t.o_team_name, locked: t.o_locked, voted: t.o_voted, members: t.o_members })));
      });

    load();
    const channel = supabase
      .channel(`team-progress:${questionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "answers", filter: `question_id=eq.${questionId}` }, load)
      .subscribe();
    const poll = setInterval(load, 3000);
    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [roomId, questionId]);

  return teams;
}
