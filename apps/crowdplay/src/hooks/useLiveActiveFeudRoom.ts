"use client";

import { useActiveFeudRoom } from "./useActiveFeudRoom";
import { useFeudRoomRealtime } from "./useFeudRoomRealtime";

/** Feud's version of useLiveActiveRoom: finds the current game and subscribes to it in full. */
export function useLiveActiveFeudRoom() {
  const activeRoom = useActiveFeudRoom();
  const code = activeRoom?.code ?? null;
  const { room, players } = useFeudRoomRealtime(code);

  if (activeRoom === undefined) return { room: undefined, players: [] };
  if (activeRoom === null) return { room: null, players: [] };
  return { room, players };
}
