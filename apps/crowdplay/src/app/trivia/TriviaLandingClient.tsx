"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveActiveRoom } from "@/hooks/useLiveActiveRoom";
import { usePlayerVenue, useVenueId } from "@/lib/venue";
import { useCountdownTo } from "@/hooks/useCountdownTo";
import { LiveGameGlance } from "@/components/LiveGameGlance";
import { LobbyRoster } from "@/components/LobbyRoster";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
import { useTriviaQueue, roundsToWaitLabel, currentGameProgress } from "@/hooks/useTriviaQueue";
import type { Player, Team } from "@/lib/types";
import { useSeason } from "@/hooks/useSeason";
import { SeasonNotice } from "@/components/SeasonNotice";
import { supabase } from "@/lib/supabase";

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
  const venue = usePlayerVenue();
  const venueId = useVenueId(venue);
  const { room, players, teams } = useLiveActiveRoom(venueId);
  const router = useRouter();
  const countdown = useCountdownTo(room?.phase === "lobby" ? room.starts_at : null);
  // Busy nights: games lined up behind this one that people can sign up
  // for now. The first one with room is where "the next game" goes.
  const queue = useTriviaQueue(venueId);
  const nextGame = queue.find((q) => !q.o_full);
  const nextLive = useRoomRealtime(nextGame?.o_code ?? null);

  // "Waiting" is a decision tied to a specific room's code, not a global
  // flag — the moment the active room changes (this one finished, a new
  // one boarded), the choice should reset so they see a fresh invitation.
  const [declinedCode, setDeclinedCode] = useState<string | null>(null);
  // Someone who waited gets asked straight away how they want to play the
  // new game (solo or their own team) instead of the generic join screen.
  const [waitedForNext, setWaitedForNext] = useState(false);
  useEffect(() => {
    if (room && declinedCode && room.code !== declinedCode) {
      setDeclinedCode(null);
      setWaitedForNext(true);
    }
  }, [room?.code, declinedCode, room]);

  // TESTING MODE: waiting out a full round (10+ minutes) just to get back
  // to a fresh lobby is too slow to iterate against while testing solo.
  // REVERT BEFORE REAL BAR SERVICE: remove this along with
  // restart_trivia_now() -- a random player shouldn't be able to cut a
  // real game short for everyone else.
  const [restarting, setRestarting] = useState(false);
  async function restartNow() {
    setRestarting(true);
    await supabase.rpc("restart_trivia_now", { p_venue: venue ?? "main" });
    setDeclinedCode(null);
    setWaitedForNext(false);
    setRestarting(false);
  }

  if (room === undefined) {
    return (
      <Shell>
        <p className="text-indigo-300">Checking for a game…</p>
      </Shell>
    );
  }

  // Mid-round joins are blocked so everyone starts on equal footing --
  // once question 1 is up, Join goes grey and Wait becomes the one to tap.
  const lobbyFull = room !== null && room.phase === "lobby" && players.filter((p) => !p.left_at).length >= 40;
  const canJoinNow = room !== null && room.phase === "lobby" && !lobbyFull;
  const isWaiting = room !== null && declinedCode === room.code;

  const statusLine =
    room === null
      ? { text: "No game running right now" }
      : room.phase === "lobby"
        ? { text: lobbyFull ? "This game is full" : "A game is boarding now" }
        : { text: "A round is happening right now" };

  if (waitedForNext && canJoinNow && room) {
    return (
      <Shell>
        <ChoiceScreen
          title="A new game is boarding"
          code={room.code}
          players={players}
          teams={teams}
          onBack={() => setWaitedForNext(false)}
          timing={
            room.starts_at && !countdown.reached ? (
              <p className="text-4xl font-black text-amber-400 tabular-nums">{countdown.label}</p>
            ) : null
          }
        />
      </Shell>
    );
  }

  // Waiting for the next game, and it's already open for sign-ups.
  if (isWaiting && nextGame) {
    const progress = currentGameProgress(nextGame);
    return (
      <Shell>
        <ChoiceScreen
          title="Get in the next game"
          code={nextGame.o_code}
          players={nextLive.players}
          teams={nextLive.teams}
          onBack={() => setDeclinedCode(null)}
          timing={
            <div className="flex flex-col items-center gap-1">
              <p className="text-2xl font-black text-amber-400">{roundsToWaitLabel(nextGame.o_rounds_to_wait)}</p>
              {progress && <p className="text-xs text-indigo-300/70">{progress}</p>}
              <p className="text-xs text-indigo-300/70 max-w-xs">
                Sign up now and you&apos;ll be in its lobby. Its countdown starts when the game before it ends.
              </p>
            </div>
          }
        />
      </Shell>
    );
  }

  if (isWaiting && room) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-xl font-bold">Got it. We&apos;ll wait for a fresh one</h2>
          <p className="text-indigo-200 max-w-xs text-sm">
            Here&apos;s what&apos;s happening right now. This updates itself the moment a new game boards.
          </p>
          <LiveGameGlance room={room} players={players} teams={teams} />
          {canJoinNow && <LobbyRoster players={players} teams={teams} />}
          {canJoinNow && (
            <button
              onClick={() => setDeclinedCode(null)}
              className="text-sm text-amber-400 hover:text-amber-300 underline mt-2"
            >
              Actually, let me join this one
            </button>
          )}
          <RestartButton onClick={restartNow} busy={restarting} />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-lg font-semibold text-indigo-200">{statusLine.text}</h2>
        {canJoinNow && room.starts_at && !countdown.reached && (
          <p className="text-4xl font-black text-amber-400 tabular-nums mt-2">{countdown.label}</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm mt-2">
        <button
          onClick={() => canJoinNow && router.push(`/play/${room.code}`)}
          disabled={!canJoinNow}
          className={`flex-1 rounded-2xl font-bold text-lg py-5 transition active:scale-95 disabled:active:scale-100 ${
            canJoinNow
              ? "bg-amber-400 text-black shadow-lg shadow-amber-400/20"
              : "bg-white/5 text-slate-500 cursor-not-allowed"
          }`}
        >
          Join the Game
        </button>
        <button
          onClick={() => room && setDeclinedCode(room.code)}
          className={`flex-1 rounded-2xl font-bold text-lg py-5 backdrop-blur transition active:scale-95 ${
            canJoinNow
              ? "bg-white/10 border border-white/20"
              : "bg-white/15 border-2 border-amber-400 shadow-lg shadow-amber-400/40"
          }`}
        >
          {!canJoinNow && nextGame ? "Join the Next Game" : "Wait for the Next Game"}
          {!canJoinNow && nextGame && (
            <span className="block text-xs font-medium text-indigo-200/80">{roundsToWaitLabel(nextGame.o_rounds_to_wait)}</span>
          )}
        </button>
      </div>

      {!canJoinNow && (
        <p className="text-xs text-indigo-300/60 max-w-xs">
          {room === null
            ? "Ask your bartender when trivia kicks off, or just wait. A new game boards automatically."
            : lobbyFull
              ? "All 8 teams are full for this one. Sign up for the next game and you'll play right after."
              : nextGame
                ? "Mid-round joins aren't allowed so everyone starts on equal footing. Sign up for the next game now and you'll be in its lobby when this one ends."
                : "Mid-round joins aren't allowed so everyone starts on equal footing. A new game boards right after this one wraps up."}
        </p>
      )}

      {/* A disabled button with no other context looks broken — a round can
          easily run 10+ minutes while boarding only lasts ~20s, so most
          visits will land mid-round. This proves the game is actually
          alive and shows how far along it is, rather than leaving the
          button as an unexplained dead end. */}
      {!canJoinNow && room && <LiveGameGlance room={room} players={players} teams={teams} />}

      {canJoinNow && (
        <>
          <p className="text-xs text-indigo-300/60 max-w-xs">
            Jump in and wait in the lobby with everyone else. No need to time it perfectly.
          </p>
          <LobbyRoster players={players} teams={teams} />
        </>
      )}

      <RestartButton onClick={restartNow} busy={restarting} />
    </Shell>
  );
}

function ChoiceScreen({
  title,
  code,
  players,
  teams,
  timing,
  onBack,
}: {
  title: string;
  code: string;
  players: Player[];
  teams: Team[];
  timing: React.ReactNode;
  onBack: () => void;
}) {
  const router = useRouter();
  return (
    <>
      <div className="flex flex-col items-center gap-3">
        <h2 className="text-xl font-bold">{title}</h2>
        {timing}
        <p className="text-indigo-200 max-w-xs text-sm">How do you want to play?</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-sm">
        <button
          onClick={() => router.push(`/play/${code}?mode=solo`)}
          className="rounded-2xl bg-amber-400 text-black font-bold text-lg py-5 shadow-lg shadow-amber-400/20 active:scale-95 transition"
        >
          Play Solo
          <span className="block text-xs font-medium text-black/70">We&apos;ll put you on a team (2 to 5 people)</span>
        </button>
        <button
          onClick={() => router.push(`/play/${code}?mode=team`)}
          className="rounded-2xl border-2 border-amber-400 bg-amber-400/10 text-amber-300 font-bold text-lg py-5 active:scale-95 transition"
        >
          Create a Team
          <span className="block text-xs font-medium text-amber-300/70">Get a team name, bring 1 to 4 friends</span>
        </button>
      </div>
      <LobbyRoster players={players} teams={teams} />
      <button onClick={onBack} className="text-xs text-indigo-300/70 underline">
        Not yet
      </button>
    </>
  );
}

function RestartButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <div className="mt-6 pt-6 border-t border-white/10 w-full max-w-sm flex flex-col items-center gap-1">
      <button
        onClick={onClick}
        disabled={busy}
        className="rounded-xl bg-white/10 border border-white/20 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/20 active:scale-95 transition disabled:opacity-40"
      >
        {busy ? "Starting…" : "Start New Game"}
      </button>
      <p className="text-xs text-indigo-300/50">Testing only: retires the current game and boards a fresh one now.</p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  // Every trivia visitor sees the monthly season and when it resets.
  const { season } = useSeason(usePlayerVenue());
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white px-6 text-center">
      <div>
        <Link href="/" className="text-sm text-indigo-300/70 hover:text-indigo-200 mb-4 inline-block">
          ← All games
        </Link>
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight">Trivia</h1>
        {season?.username && <p className="mt-2 text-sm text-indigo-200">Playing as {season.username}</p>}
      </div>
      <SeasonNotice season={season} />
      {children}
      <Link href="/host" className="text-xs text-indigo-300/50 hover:text-indigo-200 mt-4">
        Running the show? Host a game →
      </Link>
    </main>
  );
}
