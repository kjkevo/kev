// Best-effort only: not all phones/browsers support the Vibration API
// (notably iOS Safari never has), so every call is silently a no-op there.
export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // ignore
    }
  }
}

export const haptics = {
  tap: () => vibrate(15),
  correct: () => vibrate([40, 60, 40]),
  wrong: () => vibrate(200),
};
