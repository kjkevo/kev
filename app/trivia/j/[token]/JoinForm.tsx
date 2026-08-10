"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getDeviceId, rememberPlayer } from "@/app/lib/trivia/deviceId";

export function JoinForm({ token }: { token: string }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const displayName = name.trim();
    if (!displayName) {
      setError("Enter a name so the leaderboard knows it's you.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/trivia/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          displayName,
          deviceId: getDeviceId(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not join. Try again.");
        setSubmitting(false);
        return;
      }
      rememberPlayer(data.sessionId, data.playerId);
      router.push(`/trivia/play/${data.sessionId}`);
    } catch {
      setError("Network error. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleJoin} className="space-y-3">
      <input
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="words"
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name or team name"
        className="w-full rounded-xl bg-white/5 border border-white/15 px-4 py-3.5 text-lg
                   text-white placeholder:text-white/30 outline-none
                   focus:border-[#00E5C4] focus:ring-2 focus:ring-[#00E5C4]/30"
        disabled={submitting}
      />

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-[#00E5C4] px-4 py-3.5 text-lg font-semibold
                   text-[#04121F] transition active:scale-[0.99]
                   disabled:opacity-60"
      >
        {submitting ? "Joining…" : "Join game"}
      </button>
    </form>
  );
}
