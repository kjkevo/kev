"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { coalesce } from "@/lib/coalesce";
import type { PowerData } from "@/lib/powers";
import type { PlayerCredentials } from "@/lib/types";

export type TeamPowerState = {
  /** Your power this game (from your character), and the question you used it on. */
  myPower: string | null;
  myUsedQuestion: string | null;
  /** The power your team used on this question, who used it, and what it showed. */
  teamPower: { power: string; playerId: string; data: PowerData } | null;
};

const EMPTY: TeamPowerState = { myPower: null, myUsedQuestion: null, teamPower: null };

/**
 * Your power and your team's power on the current question, live (realtime
 * on trivia_powers plus a slow poll). Pass no question to turn it off.
 */
export function usePowers(roomId: string | undefined, questionId: string | undefined, creds: PlayerCredentials | null) {
  const [state, setState] = useState<TeamPowerState>(EMPTY);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const playerId = creds?.playerId;
  const clientToken = creds?.clientToken;

  useEffect(() => {
    setState(EMPTY);
    if (!roomId || !questionId || !playerId || !clientToken) return;
    let cancelled = false;
    const load = coalesce(async () => {
      const { data } = await supabase.rpc("get_team_powers", {
        p_room_id: roomId,
        p_player_id: playerId,
        p_client_token: clientToken,
        p_question_id: questionId,
      });
      const row = data?.[0];
      if (cancelled || !row) return;
      setState({
        myPower: row.o_my_power,
        myUsedQuestion: row.o_my_used_question,
        teamPower:
          row.o_team_power && row.o_team_player
            ? { power: row.o_team_power, playerId: row.o_team_player, data: (row.o_team_data ?? {}) as PowerData }
            : null,
      });
    }, 300);
    load();
    const channel = supabase
      .channel(`powers:${questionId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trivia_powers", filter: `room_id=eq.${roomId}` }, load)
      .subscribe();
    const poll = setInterval(load, 2000);
    return () => {
      cancelled = true;
      load.stop();
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [roomId, questionId, playerId, clientToken, refreshKey]);

  return { ...state, refresh };
}

export type RoomPower = { id: string; team_id: string; player_id: string; power: string; amount: number; target_team_id: string | null };

/** Every power used on this question in the room, for the TV's feed. */
export function useRoomPowers(roomId: string | undefined, questionId: string | undefined) {
  const [powers, setPowers] = useState<RoomPower[]>([]);
  useEffect(() => {
    setPowers([]);
    if (!roomId || !questionId) return;
    let cancelled = false;
    const load = coalesce(async () => {
      const { data } = await supabase
        .from("trivia_powers")
        .select("id, team_id, player_id, power, amount, target_team_id")
        .eq("room_id", roomId)
        .eq("question_id", questionId)
        .order("created_at");
      if (!cancelled && data) setPowers(data as RoomPower[]);
    }, 300);
    load();
    const channel = supabase
      .channel(`room-powers:${questionId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trivia_powers", filter: `room_id=eq.${roomId}` }, load)
      .subscribe();
    const poll = setInterval(load, 2000);
    return () => {
      cancelled = true;
      load.stop();
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [roomId, questionId]);
  return powers;
}
