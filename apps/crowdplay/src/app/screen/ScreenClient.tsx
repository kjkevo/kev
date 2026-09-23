"use client";

import { useMemo } from "react";
import { useActiveRoom } from "@/hooks/useActiveRoom";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
import { useCurrentQuestion } from "@/hooks/useCurrentQuestion";
import { useCountdown } from "@/hooks/useCountdown";
import { useCountdownTo } from "@/hooks/useCountdownTo";
import { useTotalQuestions } from "@/hooks/useTotalQuestions";
import { useAllPacks } from "@/hooks/useAllPacks";
import { useCategoryVoteTally } from "@/hooks/useCategoryVoteTally";
import { JoinQRCode } from "@/components/JoinQRCode";
import type { Player } from "@/lib/types";

const CHOICE_STYLES = ["bg-rose-600", "bg-blue-600", "bg-amber-500", "bg-emerald-600"];

/**
 * The venue's TV/projector view — leave this open all night. It always
 * follows whatever game is currently active (no room code needed) and is
 * pure spectator: no buttons, nothing to click. The database's autonomous
 * ticker drives every phase change on its own, so this page just reflects
 * whatever's true right now, the same as any player's phone would.
 */
export default function ScreenClient() {
  const activeRoom = useActiveRoom();
  const code = activeRoom?.code ?? null;
  const { room, players } = useRoomRealtime(code);
  const question = useCurrentQuestion(room?.id, room?.current_question_index, room?.phase);
  const countdown = useCountdown(room?.question_started_at ?? null, question?.time_limit_seconds ?? 15);
  const scheduledCountdown = useCountdownTo(room?.starts_at ?? null);
  const totalQuestions = useTotalQuestions(room?.id, room?.phase);
  const packs = useAllPacks();
  const voteTally = useCategoryVoteTally(room?.phase === "lobby" ? room?.id : undefined);

  // "Active" excludes anyone who's left -- the leaderboard keeps everyone
  // (including anyone who left), since a score already earned shouldn't
  // just vanish from the standings.
  const activePlayers = useMemo(() => players.filter((p) => !p.left_at), [players]);
  const sortedPlayers = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players]);
  const sortedActivePlayers = useMemo(() => [...activePlayers].sort((a, b) => b.score - a.score), [activePlayers]);

  if (activeRoom === undefined || !room) {
    return <FullscreenMessage text="Waiting for the next game…" />;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/10">
        <span className="font-black text-xl">
          Crowd<span className="text-amber-400">Play</span>
        </span>
        <span className="text-slate-400">
          {activePlayers.length} player{activePlayers.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 text-center gap-8">
        {room.phase === "lobby" && (
          <>
            <p className="text-2xl text-slate-300">Join at</p>
            <p className="text-5xl font-black tracking-widest text-amber-400">{room.code}</p>
            <JoinQRCode code={room.code} />
            {room.starts_at && !scheduledCountdown.reached && (
              <p className="text-lg text-slate-300">
                Starting in <span className="text-amber-400 font-bold tabular-nums">{scheduledCountdown.label}</span>
              </p>
            )}
            {room.category_option_a && room.category_option_b && (
              <div className="w-full max-w-md">
                <p className="text-sm text-slate-400 mb-2">Voting on the topic:</p>
                <div className="grid grid-cols-2 gap-3">
                  <VoteOption name={packs[room.category_option_a]?.name} count={voteTally.a} />
                  <VoteOption name={packs[room.category_option_b]?.name} count={voteTally.b} />
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-3 justify-center max-w-2xl">
              {sortedActivePlayers.map((p) => (
                <span key={p.id} className="bg-white/10 rounded-full px-4 py-2 text-lg">
                  {p.nickname}
                </span>
              ))}
            </div>
          </>
        )}

        {/* If every player answers fast, the room advances to "reveal"
            before this screen's own countdown runs out — that's the point
            for players (instant feedback), but the shared TV shouldn't
            spoil the answer early for a whole room of onlookers. Hold on
            the question view here until the real timer has actually
            elapsed, regardless of how fast the phase itself moved on. */}
        {(room.phase === "question" || (room.phase === "reveal" && !countdown.expired)) && question && (
          <>
            <div className="w-full max-w-3xl h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-[width] duration-100 linear"
                style={{ width: `${countdown.fraction * 100}%` }}
              />
            </div>
            <p className="text-lg text-slate-400">
              Question {room.current_question_index + 1} of {totalQuestions || "?"} · {countdown.remainingSeconds}s
            </p>
            <h2 className="text-4xl font-bold max-w-3xl">{question.prompt}</h2>
            <div className="grid grid-cols-2 gap-4 w-full max-w-3xl">
              {(question.choices as string[]).map((choice, i) => (
                <div key={i} className={`${CHOICE_STYLES[i]} rounded-xl py-6 px-4 text-xl font-semibold`}>
                  {choice}
                </div>
              ))}
            </div>
          </>
        )}

        {room.phase === "reveal" && countdown.expired && question && (
          <>
            <h2 className="text-3xl font-bold max-w-3xl">{question.prompt}</h2>
            <div className="grid grid-cols-2 gap-4 w-full max-w-3xl">
              {(question.choices as string[]).map((choice, i) => (
                <div
                  key={i}
                  className={`${CHOICE_STYLES[i]} rounded-xl py-6 px-4 text-xl font-semibold ${
                    i === room.revealed_correct_index ? "ring-4 ring-white scale-105" : "opacity-40"
                  } transition`}
                >
                  {choice} {i === room.revealed_correct_index && "(Correct)"}
                </div>
              ))}
            </div>
          </>
        )}

        {room.phase === "leaderboard" && <Leaderboard players={sortedPlayers} />}

        {room.phase === "final" && (
          <>
            <h2 className="text-4xl font-black text-amber-400">Final Results</h2>
            <Leaderboard players={sortedPlayers} />
            <p className="text-slate-400">Next game boarding shortly…</p>
          </>
        )}
      </div>
    </main>
  );
}

function VoteOption({ name, count }: { name: string | undefined; count: number }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
      <div className="font-semibold">{name ?? "…"}</div>
      <div className="text-amber-400 font-bold text-lg">{count}</div>
    </div>
  );
}

function Leaderboard({ players }: { players: Player[] }) {
  return (
    <div className="w-full max-w-lg flex flex-col gap-2">
      {players.slice(0, 10).map((p, i) => (
        <div key={p.id} className="flex items-center justify-between bg-white/5 rounded-xl px-5 py-3 text-lg">
          <span className="font-semibold">
            #{i + 1} {p.nickname}
          </span>
          <span className="text-amber-400 font-bold">{p.score}</span>
        </div>
      ))}
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
