"use client";

import { useEffect, useState } from "react";

/** Counts down to an absolute timestamp, e.g. a room's scheduled starts_at. */
export function useCountdownTo(target: string | null) {
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    target ? new Date(target).getTime() - Date.now() : 0
  );

  useEffect(() => {
    if (!target) {
      setRemainingMs(0);
      return;
    }
    const deadline = new Date(target).getTime();
    const tick = () => setRemainingMs(deadline - Date.now());
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [target]);

  const clamped = Math.max(0, remainingMs);
  const totalSeconds = Math.ceil(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return {
    remainingMs,
    reached: target !== null && remainingMs <= 0,
    label: `${minutes}:${seconds.toString().padStart(2, "0")}`,
  };
}
