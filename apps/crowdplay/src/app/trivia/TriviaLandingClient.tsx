"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveActiveRoom } from "@/hooks/useLiveActiveRoom";
import { useCountdownTo } from "@/hooks/useCountdownTo";
import { LiveGameGlance } from "@/components/LiveGameGlance";

/**
 * The entry point for anyone who lands here without a specific room code
 * (a QR code always skips straight to /play/{code} — this page is for
 * someone opening the site cold). Games now run on their own around the
 * clock (see the autonomous ticker), boarding a fresh one automatically,
 * so at any moment there is exactly one current room somewhere in its
 * lifecycle. This screen always offers the same two explicit choices
 * regardless of that state: join what's happening/about to happen, or say
 * "not this one" and wait for a clean start — with a live view of the
 * current game either way, so waiting never means staring at a blank page.
 */
export default function TriviaLandingClient() {
  const { room, players } = useLiveActiveRoom();
  const router = useRouter();
  const countdown = useCountdownTo(room?.phase === "lobby" ? room.starts_at : null);

  // "Waiting" is a decision tied to a specific room's code, not a global
  // flag — the moment the active room changes (this one finished, a new
  // one boarded), the choice should reset so they see a fresh invitation.
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

  // TESTING MODE: normally gated on room.phase === "lobby" so mid-round
  // joins are blocked for fairness. Relaxed to always-joinable while
  // solo-testing (the join_room RPC accepts joins at any phase for now
  // too) -- revert both before real bar service.
  const canJoinNow = room !== null;
  const isWaiting = room !== null && declinedCode === room.code;

  const statusLine =
    room === null
      ? { emoji: "🎤", text: "No game running right now" }
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
          <LiveGameGlance room={room} players={players} />
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
          onClick={() => canJoinNow && router.push(`/play/${room.code}`)}
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
            ? "Ask your bartender when trivia kicks off, or just wait — a new game boards automatically."
            : "Mid-round joins aren't allowed so everyone starts on equal footing. A new game boards right after this one wraps up."}
        </p>
      )}

      {/* A disabled button with no other context looks broken — a round can
          easily run 10+ minutes while boarding only lasts ~20s, so most
          visits will land mid-round. This proves the game is actually
          alive and shows how far along it is, rather than leaving the
          button as an unexplained dead end. */}
      {!canJoinNow && room && <LiveGameGlance room={room} players={players} />}

      {canJoinNow && (
        <p className="text-xs text-indigo-300/60 max-w-xs">
          Jump in and wait in the lobby with everyone else — no need to time it perfectly.
        </p>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white px-6 text-center">
      <div>
        <Link href="/" className="text-sm text-indigo-300/70 hover:text-indigo-200 mb-4 inline-block">
          ← All games
        </Link>
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight">Trivia</h1>
      </div>
      {children}
      <Link href="/host" className="text-xs text-indigo-300/50 hover:text-indigo-200 mt-4">
        Running the show? Host a game →
      </Link>
    </main>
  );
}
