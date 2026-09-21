"use client";

import Link from "next/link";
import { useActiveRoom } from "@/hooks/useActiveRoom";
import { useCountdownTo } from "@/hooks/useCountdownTo";

export default function TriviaLandingClient() {
  const room = useActiveRoom();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white px-6 text-center">
      <div>
        <Link href="/" className="text-sm text-indigo-300/70 hover:text-indigo-200 mb-4 inline-block">
          ← All games
        </Link>
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight">Trivia</h1>
      </div>

      {room === undefined && <p className="text-indigo-300">Checking for a game…</p>}

      {room === null && <NoGame />}

      {room && room.phase === "lobby" && <UpcomingGame code={room.code} startsAt={room.starts_at} />}

      {room && room.phase !== "lobby" && <GameInProgress />}

      <Link href="/host" className="text-xs text-indigo-300/50 hover:text-indigo-200 mt-4">
        Running the show? Host a game →
      </Link>
    </main>
  );
}

function NoGame() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-2xl">🎤</p>
      <h2 className="text-xl font-bold">No game running yet</h2>
      <p className="text-indigo-200 max-w-xs">Ask your bartender when the next round kicks off, or check back soon.</p>
    </div>
  );
}

function GameInProgress() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-2xl">🔥</p>
      <h2 className="text-xl font-bold">A round is happening right now</h2>
      <p className="text-indigo-200 max-w-xs">
        Mid-round joins aren&apos;t allowed so everyone starts on equal footing — hang tight for the next one.
      </p>
    </div>
  );
}

function UpcomingGame({ code, startsAt }: { code: string; startsAt: string | null }) {
  const countdown = useCountdownTo(startsAt);
  const showCountdown = startsAt !== null && !countdown.reached;

  return (
    <div className="flex flex-col items-center gap-5">
      {showCountdown ? (
        <>
          <p className="text-indigo-300 uppercase tracking-widest text-sm">Next game starts in</p>
          <p className="text-6xl font-black text-amber-400 tabular-nums">{countdown.label}</p>
        </>
      ) : (
        <p className="text-xl font-bold text-amber-400">Starting any moment 🎉</p>
      )}
      <Link
        href={`/play/${code}`}
        className="rounded-2xl bg-amber-400 text-black font-bold text-xl px-10 py-5 shadow-lg shadow-amber-400/20 active:scale-95 transition"
      >
        Join Now
      </Link>
      <p className="text-xs text-indigo-300/60 max-w-xs">
        Jump in early and wait in the lobby with everyone else — no need to time it perfectly.
      </p>
    </div>
  );
}
