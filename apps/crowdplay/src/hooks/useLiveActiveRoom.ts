"use client";

import { useActiveRoom } from "./useActiveRoom";
import { useRoomRealtime } from "./useRoomRealtime";

/**
 * Finds "the game" for the venue (useActiveRoom's most-recent-non-final
 * lookup) and then subscribes to it in full detail, including players and
 * teams — the same two-step pattern /screen uses. Shared here so /trivia's
 * waiting view can show the same live picture without re-deriving it.
 */
export function useLiveActiveRoom(venueId: string | null | undefined) {
  const activeRoom = useActiveRoom(venueId); // Room | null (none exists) | undefined (loading)
  const code = activeRoom?.code ?? null;
  const { room, players, teams } = useRoomRealtime(code);

  if (activeRoom === undefined) return { room: undefined, players: [], teams: [] };
  if (activeRoom === null) return { room: null, players: [], teams: [] };
  return { room, players, teams };
}
