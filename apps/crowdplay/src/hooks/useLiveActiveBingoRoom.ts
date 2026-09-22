"use client";

import { useActiveBingoRoom } from "./useActiveBingoRoom";
import { useBingoRoomRealtime } from "./useBingoRoomRealtime";

/** Bingo's version of useLiveActiveRoom: finds the current game and subscribes to it in full. */
export function useLiveActiveBingoRoom() {
  const activeRoom = useActiveBingoRoom();
  const code = activeRoom?.code ?? null;
  const { room, players } = useBingoRoomRealtime(code);

  if (activeRoom === undefined) return { room: undefined, players: [] };
  if (activeRoom === null) return { room: null, players: [] };
  return { room, players };
}
