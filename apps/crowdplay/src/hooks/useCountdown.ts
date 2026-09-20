"use client";

import { useEffect, useState } from "react";

/**
 * Purely a display timer — the real deadline is enforced server-side in
 * submit_answer(). A phone with a fast/slow clock might see :01 more or
 * less than everyone else, but it can never buy extra scoring time.
 */
export function useCountdown(startedAt: string | null, limitSeconds: number) {
  const [remainingMs, setRemainingMs] = useState<number>(limitSeconds * 1000);

  useEffect(() => {
    if (!startedAt) return;
    const deadline = new Date(startedAt).getTime() + limitSeconds * 1000;

    const tick = () => setRemainingMs(Math.max(0, deadline - Date.now()));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [startedAt, limitSeconds]);

  return {
    remainingMs,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    fraction: Math.max(0, Math.min(1, remainingMs / (limitSeconds * 1000))),
    expired: remainingMs <= 0,
  };
}
