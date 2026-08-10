"use client";

// A lightweight per-device identity. v1 has no accounts — a player is just a
// stable random id kept in localStorage. Good enough to keep a phone's score
// across a game and to record venue visit history.

const DEVICE_KEY = "trivia_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

// Remember which player row this device is in a given session, so the play
// screen knows who "you" are without an account.
export function rememberPlayer(sessionId: string, playerId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`trivia_player_${sessionId}`, playerId);
}

export function getRememberedPlayer(sessionId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`trivia_player_${sessionId}`);
}
