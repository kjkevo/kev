"use client";

import { useEffect, useState } from "react";
import { MyCharacterButton } from "@/components/CharacterLocker";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useLiveActiveRoom } from "@/hooks/useLiveActiveRoom";
import { useActiveRoom } from "@/hooks/useActiveRoom";
import { Icon } from "@/components/Icon";
import { usePlayerVenue, useVenueId } from "@/lib/venue";
import { useCountdownTo } from "@/hooks/useCountdownTo";
import { LiveGameGlance } from "@/components/LiveGameGlance";
import { LobbyRoster } from "@/components/LobbyRoster";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
import { useTriviaQueue, roundsToWaitLabel, currentGameProgress } from "@/hooks/useTriviaQueue";
import { playerKey, type Player, type Team } from "@/lib/types";
import { useSeason } from "@/hooks/useSeason";
import { SeasonChip } from "@/components/SeasonNotice";

/**
 * The entry point for anyone without a room code: the venue TV's QR code
 * lands here, as does someone opening the site cold. Each venue runs two
 * games side by side: Solo (everyone for themselves, join any time, bots
 * step out as people join) and Team Play (the venue TV's game: always teams of 4,
 * bots filling open spots, no joining mid-game). A clear button for each.
 */
export default function TriviaLandingClient() {
  const venue = usePlayerVenue();
  const venueId = useVenueId(venue);
  const { room, players, teams } = useLiveActiveRoom(venueId, "team");
  const soloRoom = useActiveRoom(venueId, "solo");
  const soloCountdown = useCountdownTo(soloRoom?.phase === "lobby" ? soloRoom.starts_at : null);
  const soloCountdownLabel = soloRoom?.starts_at && !soloCountdown.reached ? soloCountdown.label : null;
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

  // Never wait behind a game with no real players in it: end it so a fresh
  // lobby boards right away (games with real people are left alone).
  useEffect(() => {
    if (venue) supabase.rpc("trivia_fresh_start", { p_venue: venue });
  }, [venue]);
  // Already in this game (or the next one) on this phone, e.g. the page was
  // closed or the phone locked: straight back into it.
  useEffect(() => {
    for (const c of [room?.code, nextGame?.o_code, soloRoom?.code]) {
      if (!c) continue;
      try {
        if (localStorage.getItem(playerKey(c))) {
          router.replace(`/play/${c}`);
          return;
        }
      } catch {}
    }
  }, [room?.code, nextGame?.o_code, soloRoom?.code, router]);
  // Someone who waited gets asked straight away how they want to play the
  // new game (solo or their own team) instead of the generic join screen.
  const [waitedForNext, setWaitedForNext] = useState(false);
  useEffect(() => {
    if (room && declinedCode && room.code !== declinedCode) {
      setDeclinedCode(null);
      setWaitedForNext(true);
    }
  }, [room?.code, declinedCode, room]);

  if (room === undefined) {
    return (
      <Shell>
        <p className="text-indigo-300">Checking for a game…</p>
      </Shell>
    );
  }

  // Mid-round joins are blocked so everyone starts on equal footing --
  // once question 1 is up, Join goes grey and Wait becomes the one to tap.
  const lobbyFull = room !== null && room.phase === "lobby" && players.filter((p) => !p.left_at).length >= 32;
  const canJoinNow = room !== null && room.phase === "lobby" && !lobbyFull;
  const isWaiting = room !== null && declinedCode === room.code;

  if (waitedForNext && canJoinNow && room) {
    return (
      <Shell>
        <ChoiceScreen
          title="New game"
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
              <p className="text-2xl font-black text-amber-400">{roundsToWaitLabel(nextGame.o_rounds_to_wait, nextGame)}</p>
              {progress && <p className="text-xs text-indigo-300/70">{progress}</p>}
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
          <h2 className="text-xl font-bold">Waiting for the next game</h2>
          <LiveGameGlance room={room} players={players} teams={teams} />
          {canJoinNow && <LobbyRoster players={players} teams={teams} />}
          {canJoinNow && (
            <button
              onClick={() => setDeclinedCode(null)}
              className="text-sm text-amber-400 hover:text-amber-300 underline mt-2"
            >
              Join this one
            </button>
          )}
        </div>
      </Shell>
    );
  }

  // Team games run side by side, so there is nearly always an open lobby;
  // between one starting and the next opening (a second) the button waits.
  const teamButton = canJoinNow
    ? { label: "Join Team Play", onClick: () => router.push(`/play/${room.code}`) }
    : { label: "Opening the next game…", onClick: () => {} };
  // A rush: the team game is a while off but a solo game is already
  // playing, so point people at Solo instead of a countdown.
  const soloNoWait = !!soloRoom && soloRoom.phase !== "lobby";
  const teamWaitLong = !canJoinNow || !room?.starts_at || countdown.remainingMs > 60_000;

  return (
    <Shell>
      <MyCharacterButton />

      <div className="flex flex-col gap-4 w-full max-w-sm">
        {/* Solo: everyone for themselves, open any time. */}
        <div className="rounded-3xl bg-amber-400/10 border border-amber-400/40 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-center gap-2">
            <Icon name="user" size={22} className="text-amber-300" />
            <h2 className="text-2xl font-black">Solo</h2>
            {soloNoWait && (
              <span className="rounded-full bg-emerald-400 text-black text-xs font-black px-2 py-0.5">No wait</span>
            )}
          </div>
          <p className="text-sm text-slate-300">
            {soloRoom === undefined
              ? "Checking…"
              : soloRoom === null
                ? "A new game opens in a moment"
                : soloRoom.phase === "lobby"
                  ? soloCountdownLabel
                    ? `Starts in ${soloCountdownLabel} · join any time`
                    : "Join any time"
                  : "Game on · jump right in"}
          </p>
          <button
            onClick={() => soloRoom && router.push(`/play/${soloRoom.code}`)}
            disabled={!soloRoom}
            className="rounded-2xl bg-amber-400 text-black font-black text-xl py-5 shadow-lg shadow-amber-400/30 disabled:opacity-40 active:scale-95 transition"
          >
            Play Solo
          </button>
        </div>

        {/* Team Play: the venue's team game (teams of 4, bots fill open spots). */}
        <div className="rounded-3xl bg-white/5 border border-white/15 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-center gap-2">
            <Icon name="users" size={22} className="text-sky-300" />
            <h2 className="text-2xl font-black">Team Play</h2>
          </div>
          <p className="text-sm text-slate-300">
            {!canJoinNow ? (
              "A new game opens in a moment"
            ) : room.starts_at && !countdown.reached ? (
              <>
                Starts in <span className="text-amber-400 font-black tabular-nums">{countdown.label}</span>
              </>
            ) : (
              "Starts when players join"
            )}
          </p>
          {soloNoWait && teamWaitLong && (
            <p className="text-xs font-bold text-emerald-300">Don&apos;t want to wait? Play Solo now</p>
          )}
          <button
            onClick={teamButton.onClick}
            disabled={!canJoinNow}
            className="rounded-2xl bg-sky-400 text-black font-black text-lg py-4 disabled:opacity-40 active:scale-95 transition"
          >
            {teamButton.label}
          </button>
        </div>
      </div>

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
      </div>
      <button
        onClick={() => router.push(`/play/${code}`)}
        className="w-full max-w-sm rounded-2xl bg-amber-400 text-black font-black text-xl py-5 shadow-lg shadow-amber-400/30 active:scale-95 transition"
      >
        Join the Game
      </button>
      <LobbyRoster players={players} teams={teams} />
      <button onClick={onBack} className="text-xs text-slate-500">
        Not yet
      </button>
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  // Every trivia visitor sees the monthly season and when it resets.
  const { season } = useSeason(usePlayerVenue());
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white px-4 py-8 text-center">
      <Link href="/" className="absolute top-4 left-4 text-sm text-indigo-300/70 hover:text-indigo-200">
        ← Games
      </Link>
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight">Trivia</h1>
        <div className="flex items-center gap-2 text-sm">
          {season?.username && <span className="font-bold text-indigo-100">{season.username}</span>}
          <SeasonChip season={season} />
        </div>
      </div>
      {children}
    </main>
  );
}
