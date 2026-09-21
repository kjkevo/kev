"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { hostKey } from "@/lib/types";

const TIMING_OPTIONS = [
  { label: "Start Now", minutes: 0 },
  { label: "In 5 min", minutes: 5 },
  { label: "In 10 min", minutes: 10 },
  { label: "In 15 min", minutes: 15 },
];

export default function HostSetupClient() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startRoom(minutesFromNow: number) {
    if (creating) return;
    setCreating(true);
    setError(null);
    const startsAt = minutesFromNow > 0 ? new Date(Date.now() + minutesFromNow * 60_000).toISOString() : null;
    const { data, error } = await supabase.rpc("create_room", {
      p_starts_at: startsAt ?? undefined,
    });
    if (error || !data?.[0]) {
      setError("Couldn't create the room. Check your connection and try again.");
      setCreating(false);
      return;
    }
    const { room_id, code, host_secret } = data[0];
    localStorage.setItem(hostKey(code), JSON.stringify({ roomId: room_id, hostSecret: host_secret }));
    router.push(`/host/${code}`);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-16 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-2">When should this round start?</h1>
      <p className="text-slate-400 mb-10 max-w-sm text-center">
        Each game mixes 2 random categories out of 8 — general knowledge, pop culture, music, sports, geography,
        food &amp; drink, decades nostalgia, and franchise trivia — so no two rounds play the same.
      </p>

      {error && <p className="text-red-400 mb-6">{error}</p>}

      <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
        {TIMING_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            onClick={() => startRoom(opt.minutes)}
            disabled={creating}
            className="rounded-xl bg-white/5 border border-white/10 hover:border-amber-400/60 px-5 py-6 font-semibold text-lg transition disabled:opacity-50"
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-8 max-w-xs text-center">
        A scheduled round shows a live countdown to players and starts itself automatically — you can still start it
        early from the host screen at any time.
      </p>
      {creating && <p className="text-amber-400 mt-4">Creating room…</p>}
    </main>
  );
}
