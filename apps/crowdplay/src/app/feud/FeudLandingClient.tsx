"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveActiveFeudRoom } from "@/hooks/useLiveActiveFeudRoom";
import { useCountdownTo } from "@/hooks/useCountdownTo";

/**
 * Family Feud's entry point, same shape as trivia's: an autonomous ticker
 * always has exactly one game somewhere in its lifecycle, so this screen
 * always offers the same two choices -- join what's happening/about to
 * happen, or wait for a clean start -- with a live glance either way.
 */
export default function FeudLandingClient() {
  const { room, players } = useLiveActiveFeudRoom();
  const router = useRouter();
  const countdown = useCountdownTo(room?.phase === "lobby" ? room.starts_at : null);

  const [declinedCode, setDeclinedCode] = useState<string | null>(null);
  useEffect(() => {
    if (room && declinedCode && room.code !== declinedCode) {
      setDeclinedCode(null);
    }
  }, [room?.code, declinedCode, room]);

  if (room === undefined) {
    return (
      <Shell>
        <p className="text-indigo-300">Checking for a game…</p>
      </Shell>
    );
  }

  const canJoinNow = room !== null && room.phase === "lobby";
  const isWaiting = room !== null && declinedCode === room.code;

  const statusLine =
    room === null
      ? { emoji: "🎙️", text: "No game running right now" }
      : room.phase === "lobby"
        ? { emoji: "🎉", text: "A game is boarding now" }
        : { emoji: "🔥", text: "A round is happening right now" };

  if (isWaiting && room) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4">
          <p className="text-3xl">⏳</p>
          <h2 className="text-xl font-bold">Got it — we&apos;ll wait for a fresh one</h2>
          <p className="text-indigo-200 max-w-xs text-sm">
            Here&apos;s what&apos;s happening right now — this updates itself the moment a new game boards.
          </p>
          <FeudGlance room={room} playerCount={players.length} />
          {canJoinNow && (
            <button
              onClick={() => setDeclinedCode(null)}
              className="text-sm text-amber-400 hover:text-amber-300 underline mt-2"
            >
              Actually, let me join this one
            </button>
          )}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col items-center gap-2">
        <p className="text-2xl">{statusLine.emoji}</p>
        <h2 className="text-lg font-semibold text-indigo-200">{statusLine.text}</h2>
        {canJoinNow && room.starts_at && !countdown.reached && (
          <p className="text-4xl font-black text-amber-400 tabular-nums mt-2">{countdown.label}</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm mt-2">
        <button
          onClick={() => canJoinNow && router.push(`/feud/play/${room.code}`)}
          disabled={!canJoinNow}
          className="flex-1 rounded-2xl bg-amber-400 text-black font-bold text-lg py-5 shadow-lg shadow-amber-400/20 active:scale-95 transition disabled:opacity-30 disabled:active:scale-100"
        >
          Join the Game
        </button>
        <button
          onClick={() => room && setDeclinedCode(room.code)}
          className="flex-1 rounded-2xl bg-white/10 border border-white/20 font-bold text-lg py-5 backdrop-blur active:scale-95 transition"
        >
          Wait for the Next Game
        </button>
      </div>

      {!canJoinNow && (
        <p className="text-xs text-indigo-300/60 max-w-xs">
          {room === null
            ? "Ask your bartender when Family Feud kicks off, or just wait — a new game boards automatically."
            : "Mid-round joins aren't allowed so both teams start on equal footing. A new game boards right after this one wraps up."}
        </p>
      )}

      {!canJoinNow && room && <FeudGlance room={room} playerCount={players.length} />}

      {canJoinNow && (
        <p className="text-xs text-indigo-300/60 max-w-xs">
          Jump in and pick a team — no need to time it perfectly.
        </p>
      )}
    </Shell>
  );
}

function FeudGlance({ room, playerCount }: { room: NonNullable<ReturnType<typeof useLiveActiveFeudRoom>["room"]>; playerCount: number }) {
  return (
    <div className="w-full max-w-sm rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col items-center gap-3">
      <p className="text-xs uppercase tracking-widest text-indigo-300">Live now</p>
      {room.phase === "lobby" ? (
        <p className="text-sm text-indigo-200">
          {playerCount} player{playerCount === 1 ? "" : "s"} in the lobby
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-400">Round {room.current_round_index} of {room.total_rounds}</p>
          <div className="grid grid-cols-2 gap-2 w-full">
            <div className="rounded-lg bg-rose-600/20 border border-rose-600/40 px-2 py-1.5 text-center">
              <div className="text-xs font-semibold truncate">{room.team_a_name}</div>
              <div className="text-amber-400 font-bold text-sm">{room.team_a_score}</div>
            </div>
            <div className="rounded-lg bg-blue-600/20 border border-blue-600/40 px-2 py-1.5 text-center">
              <div className="text-xs font-semibold truncate">{room.team_b_name}</div>
              <div className="text-amber-400 font-bold text-sm">{room.team_b_score}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white px-6 text-center">
      <div>
        <Link href="/" className="text-sm text-indigo-300/70 hover:text-indigo-200 mb-4 inline-block">
          ← All games
        </Link>
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight">Family Feud</h1>
      </div>
      {children}
      <Link href="/feud/screen" className="text-xs text-indigo-300/50 hover:text-indigo-200 mt-4">
        Running the show? Open the big screen →
      </Link>
    </main>
  );
}
