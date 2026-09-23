"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Player, Room, Team } from "@/lib/types";

/**
 * Single source of truth for "what's happening in this room right now",
 * shared by both the host screen and every player's phone. Rides on
 * Postgres realtime changes to `rooms`, `players`, and `teams` — if a
 * phone's websocket drops (locked screen, bad wifi) and reconnects, the
 * initial select below re-syncs it rather than leaving it stuck on stale
 * state. Scoring is team-based now, so `teams` (with each team's score) is
 * as core to "what's happening" as `players` (who's on which team) is.
 */
export function useRoomRealtime(code: string | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data: roomRow } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code!.toUpperCase())
        .maybeSingle();

      if (cancelled) return;
      if (!roomRow) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setRoom(roomRow);

      const [{ data: playerRows }, { data: teamRows }] = await Promise.all([
        supabase.from("players").select("*").eq("room_id", roomRow.id).order("joined_at", { ascending: true }),
        supabase.from("teams").select("*").eq("room_id", roomRow.id).order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;
      setPlayers(playerRows ?? []);
      setTeams(teamRows ?? []);
      setLoading(false);

      const refetchPlayers = () =>
        supabase
          .from("players")
          .select("*")
          .eq("room_id", roomRow.id)
          .order("joined_at", { ascending: true })
          .then(({ data }) => {
            if (!cancelled) setPlayers(data ?? []);
          });

      const refetchTeams = () =>
        supabase
          .from("teams")
          .select("*")
          .eq("room_id", roomRow.id)
          .order("created_at", { ascending: true })
          .then(({ data }) => {
            if (!cancelled) setTeams(data ?? []);
          });

      const channel = supabase
        .channel(`room:${roomRow.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomRow.id}` },
          (payload) => {
            if (payload.eventType === "DELETE") return;
            setRoom(payload.new as Room);
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomRow.id}` },
          refetchPlayers
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "teams", filter: `room_id=eq.${roomRow.id}` },
          refetchTeams
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const cleanupPromise = load();
    return () => {
      cancelled = true;
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [code]);

  return { room, players, teams, loading, notFound };
}
