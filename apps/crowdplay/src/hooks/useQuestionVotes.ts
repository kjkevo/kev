"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PlayerCredentials } from "@/lib/types";

/**
 * Live "who on my team voted for what" for the current question. Answer
 * text isn't readable from the answers table (another team could copy it),
 * so it comes from get_team_votes, which only returns your own team's votes.
 * Realtime on answers still fires for inserts/updates (the columns it can
 * see) and just triggers a refetch; a slow poll covers any missed event.
 * Also reports whether the team's answer is locked in (everyone agreed), and
 * with what. `refresh` lets the caller refetch right after casting a vote.
 */
export function useQuestionVotes(
  roomId: string | undefined,
  questionId: string | undefined,
  creds: PlayerCredentials | null
) {
  const [votes, setVotes] = useState<Record<string, string>>({}); // player_id -> answer_text
  const [lock, setLock] = useState<string | null>(null); // the team's locked-in answer, if any
  const playerId = creds?.playerId;
  const clientToken = creds?.clientToken;

  const fetchVotes = useCallback(async () => {
    if (!roomId || !questionId || !playerId || !clientToken) return null;
    const { data, error } = await supabase.rpc("get_team_votes", {
      p_room_id: roomId,
      p_player_id: playerId,
      p_client_token: clientToken,
      p_question_id: questionId,
    });
    if (error || !data) return null;
    const next: Record<string, string> = {};
    for (const row of data) if (row.o_answer_text) next[row.o_player_id] = row.o_answer_text;
    const locked = await supabase.rpc("get_team_answer_lock", {
      p_room_id: roomId,
      p_player_id: playerId,
      p_client_token: clientToken,
      p_question_id: questionId,
    });
    const row = locked.data?.[0];
    return { votes: next, lock: row?.o_locked ? row.o_answer_text : null };
  }, [roomId, questionId, playerId, clientToken]);

  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!questionId) {
      setVotes({});
      setLock(null);
      return;
    }
    let cancelled = false;
    const load = () =>
      fetchVotes().then((next) => {
        if (cancelled || !next) return;
        setVotes(next.votes);
        setLock(next.lock);
      });

    load();
    const channel = supabase
      .channel(`votes:${questionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "answers", filter: `question_id=eq.${questionId}` },
        load
      )
      .subscribe();
    const poll = setInterval(load, 3000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [questionId, fetchVotes, refreshKey]);

  return { votes, lock, refresh };
}
