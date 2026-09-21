"use client";

import { useActiveFeudRoom } from "@/hooks/useActiveFeudRoom";
import { useFeudRoomRealtime } from "@/hooks/useFeudRoomRealtime";
import { useCountdownTo } from "@/hooks/useCountdownTo";
import { JoinQRCode } from "@/components/JoinQRCode";
import type { FeudBoardSlot } from "@/lib/types";

/**
 * The venue's TV/projector view for Family Feud — pure spectator, no
 * buttons. Follows whatever game is currently active; the database's
 * autonomous ticker drives every phase change on its own.
 */
export default function FeudScreenClient() {
  const activeRoom = useActiveFeudRoom();
  const code = activeRoom?.code ?? null;
  const { room, players } = useFeudRoomRealtime(code);
  const scheduledCountdown = useCountdownTo(room?.starts_at ?? null);

  if (activeRoom === undefined || !room) {
    return <FullscreenMessage text="Waiting for the next game…" />;
  }

  const board = (room.board as unknown as FeudBoardSlot[]) ?? [];
  const teamAPlayers = players.filter((p) => p.team === "a");
  const teamBPlayers = players.filter((p) => p.team === "b");

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/10">
        <span className="font-black text-xl">
          Crowd<span className="text-amber-400">Play</span> · Family Feud
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
            <JoinQRCode code={room.code} basePath="/feud/play" />
            {room.starts_at && !scheduledCountdown.reached && (
              <p className="text-lg text-slate-300">
                Starting in <span className="text-amber-400 font-bold tabular-nums">{scheduledCountdown.label}</span>
              </p>
            )}
            <div className="grid grid-cols-2 gap-8 w-full max-w-2xl">
              <TeamList name={room.team_a_name} color="bg-rose-600" players={teamAPlayers.map((p) => p.nickname)} />
              <TeamList name={room.team_b_name} color="bg-blue-600" players={teamBPlayers.map((p) => p.nickname)} />
            </div>
          </>
        )}

        {(room.phase === "play" || room.phase === "steal") && (
          <>
            <p className="text-lg text-slate-400">
              Round {room.current_round_index} of {room.total_rounds} · Pot: {room.pot}
            </p>
            <h2 className="text-4xl font-bold max-w-4xl">{room.current_prompt}</h2>
            <div className="grid grid-cols-2 gap-4 w-full max-w-3xl">
              {board.map((slot, i) => (
                <div
                  key={i}
                  className={`rounded-xl py-4 px-5 text-xl font-semibold flex items-center justify-between ${
                    slot.revealed ? "bg-emerald-700" : "bg-white/5 border border-white/10"
                  }`}
                >
                  <span>{slot.revealed ? slot.text : `#${i + 1}`}</span>
                  <span className="text-amber-300 font-bold">{slot.revealed ? slot.points : "?"}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-2xl ${
                    i < room.strikes ? "bg-red-600" : "bg-white/10 text-white/20"
                  }`}
                >
                  ✕
                </span>
              ))}
            </div>
            <TeamScores room={room} />
          </>
        )}

        {room.phase === "reveal" && (
          <>
            <h2 className="text-3xl font-bold max-w-4xl">{room.current_prompt}</h2>
            <div className="grid grid-cols-2 gap-4 w-full max-w-3xl">
              {board.map((slot, i) => (
                <div key={i} className="rounded-xl py-4 px-5 text-xl font-semibold flex items-center justify-between bg-emerald-700">
                  <span>{slot.text ?? `#${i + 1}`}</span>
                  <span className="text-amber-300 font-bold">{slot.points ?? "-"}</span>
                </div>
              ))}
            </div>
            <TeamScores room={room} />
          </>
        )}

        {(room.phase === "leaderboard" || room.phase === "final") && (
          <>
            <h2 className="text-4xl font-black text-amber-400">
              {room.phase === "final" ? "🎉 Final Results 🎉" : `Round ${room.current_round_index} of ${room.total_rounds}`}
            </h2>
            <TeamScores room={room} big />
            {room.phase === "final" ? (
              <p className="text-2xl font-bold text-amber-400">
                {room.team_a_score === room.team_b_score
                  ? "It's a tie!"
                  : `${room.team_a_score > room.team_b_score ? room.team_a_name : room.team_b_name} wins!`}
              </p>
            ) : (
              <p className="text-slate-400">Next round starting shortly…</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function TeamList({ name, color, players }: { name: string; color: string; players: string[] }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-left">
      <div className={`${color} text-sm font-bold rounded-full px-3 py-1 inline-block mb-3`}>{name}</div>
      <div className="flex flex-wrap gap-2">
        {players.length === 0 ? (
          <span className="text-slate-500 text-sm">No one yet</span>
        ) : (
          players.map((n) => (
            <span key={n} className="bg-white/10 rounded-full px-3 py-1 text-sm">
              {n}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function TeamScores({
  room,
  big = false,
}: {
  room: { team_a_name: string; team_b_name: string; team_a_score: number; team_b_score: number };
  big?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-6 w-full max-w-2xl">
      <div className="rounded-2xl bg-rose-600/20 border border-rose-600/40 p-5 text-center">
        <div className="text-lg font-semibold text-rose-300">{room.team_a_name}</div>
        <div className={`font-black text-amber-400 ${big ? "text-6xl" : "text-3xl"}`}>{room.team_a_score}</div>
      </div>
      <div className="rounded-2xl bg-blue-600/20 border border-blue-600/40 p-5 text-center">
        <div className="text-lg font-semibold text-blue-300">{room.team_b_name}</div>
        <div className={`font-black text-amber-400 ${big ? "text-6xl" : "text-3xl"}`}>{room.team_b_score}</div>
      </div>
    </div>
  );
}

function FullscreenMessage({ text }: { text: string }) {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-8 text-center text-xl">
      {text}
    </main>
  );
}
