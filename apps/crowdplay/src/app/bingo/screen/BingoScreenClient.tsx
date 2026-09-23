"use client";

import { useActiveBingoRoom } from "@/hooks/useActiveBingoRoom";
import { useBingoRoomRealtime } from "@/hooks/useBingoRoomRealtime";
import { useCountdownTo } from "@/hooks/useCountdownTo";
import { useCountdown } from "@/hooks/useCountdown";
import { JoinQRCode } from "@/components/JoinQRCode";
import { ScreenAgent } from "@/components/ScreenAgent";
import { useScreenVenue } from "@/lib/venue";
import { CircularTimer } from "@/components/CircularTimer";
import type { BingoPlayer } from "@/lib/types";

const REVEAL_DWELL_SECONDS = 8;
const LEADERBOARD_DWELL_SECONDS = 8;

/**
 * The venue's TV/projector view for Social Bingo -- pure spectator, no
 * buttons. Follows whatever game is currently active; the database's
 * autonomous ticker drives every phase change on its own.
 */
export default function BingoScreenClient() {
  const venue = useScreenVenue();
  const activeRoom = useActiveBingoRoom();
  const code = activeRoom?.code ?? null;
  const { room, players } = useBingoRoomRealtime(code);
  const scheduledCountdown = useCountdownTo(room?.starts_at ?? null);
  const roundCountdown = useCountdown(
    room?.phase === "playing" ? room.phase_started_at : null,
    room?.round_duration_seconds ?? 300
  );
  const phaseDwellLimit =
    room?.phase === "reveal" ? REVEAL_DWELL_SECONDS : room?.phase === "leaderboard" ? LEADERBOARD_DWELL_SECONDS : 1;
  const dwellCountdown = useCountdown(room?.phase_started_at ?? null, phaseDwellLimit);

  if (activeRoom === undefined || !room) {
    return (
      <>
        <ScreenAgent venue={venue} page="/bingo/screen" />
        <FullscreenMessage text="Waiting for the next game…" />
      </>
    );
  }

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = players.find((p) => p.id === room.winner_player_id);

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col">
      <ScreenAgent venue={venue} page="/bingo/screen" />
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/10">
        <span className="font-black text-xl">
          Crowd<span className="text-amber-400">Play</span> &middot; Social Bingo
        </span>
        <span className="text-slate-400">
          {players.length} player{players.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 text-center gap-8">
        {room.phase === "lobby" && (
          <>
            <p className="text-2xl text-slate-300">Join at</p>
            <p className="text-5xl font-black tracking-widest text-amber-400">{room.code}</p>
            <JoinQRCode code={room.code} basePath="/bingo/play" venue={venue} />
            {room.starts_at && !scheduledCountdown.reached && (
              <p className="text-xl text-slate-400">
                Starting in <span className="text-amber-400 font-bold tabular-nums">{scheduledCountdown.label}</span>
              </p>
            )}
            <PlayerChips players={players} />
          </>
        )}

        {room.phase === "playing" && (
          <>
            <div className="flex items-center gap-4">
              <CircularTimer fraction={roundCountdown.fraction} size={64} strokeWidth={5} label={roundCountdown.remainingSeconds} />
              <h2 className="text-3xl font-bold">Round {room.current_round_index} of {room.total_rounds}</h2>
            </div>
            <p className="text-slate-400 max-w-lg">
              Mingle and mark your card. First to complete a row, column, or diagonal calls Bingo!
            </p>
            <ProgressList players={players} />
          </>
        )}

        {room.phase === "reveal" && (
          <>
            <CircularTimer fraction={dwellCountdown.fraction} size={56} />
            {winner ? (
              <>
                <h2 className="text-5xl font-black text-amber-400">Bingo!</h2>
                <p className="text-2xl">{winner.nickname} got it first</p>
              </>
            ) : (
              <>
                <h2 className="text-4xl font-bold">Time&apos;s up</h2>
                <p className="text-slate-400">Nobody completed a line this round</p>
              </>
            )}
          </>
        )}

        {room.phase === "leaderboard" && (
          <>
            <div className="flex items-center gap-3">
              <CircularTimer fraction={dwellCountdown.fraction} size={32} strokeWidth={3} />
              <h2 className="text-3xl font-bold">Leaderboard</h2>
            </div>
            <Leaderboard players={sorted} />
          </>
        )}

        {room.phase === "final" && (
          <>
            <h2 className="text-4xl font-black text-amber-400">Final Results</h2>
            <Leaderboard players={sorted} />
            <p className="text-slate-400">Next game boarding shortly…</p>
          </>
        )}
      </div>
    </main>
  );
}

function PlayerChips({ players }: { players: BingoPlayer[] }) {
  return (
    <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
      {players.slice(-24).map((p) => (
        <span key={p.id} className="bg-white/10 rounded-full px-4 py-1.5 text-sm">
          {p.nickname}
        </span>
      ))}
    </div>
  );
}

function ProgressList({ players }: { players: BingoPlayer[] }) {
  const withProgress = players
    .map((p) => ({
      ...p,
      marks: ((p.marked as unknown as boolean[] | null) ?? []).filter(Boolean).length,
    }))
    .sort((a, b) => b.marks - a.marks)
    .slice(0, 8);

  return (
    <div className="w-full max-w-md flex flex-col gap-1.5">
      {withProgress.map((p) => (
        <div key={p.id} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-1.5 text-sm">
          <span>{p.nickname}</span>
          <span className="text-amber-400 font-bold">{p.marks - 1}/24</span>
        </div>
      ))}
    </div>
  );
}

function Leaderboard({ players }: { players: BingoPlayer[] }) {
  return (
    <div className="w-full max-w-md flex flex-col gap-2">
      {players.slice(0, 8).map((p, i) => (
        <div key={p.id} className="flex items-center justify-between bg-white/5 rounded-xl px-5 py-2.5">
          <span className="font-semibold">
            {i + 1}. {p.nickname}
          </span>
          <span className="text-amber-400 font-bold">{p.score}</span>
        </div>
      ))}
    </div>
  );
}

function FullscreenMessage({ text }: { text: string }) {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <p className="text-2xl text-slate-400">{text}</p>
    </main>
  );
}
