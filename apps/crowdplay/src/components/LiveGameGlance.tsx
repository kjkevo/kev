"use client";

import { useMemo } from "react";
import { useCurrentQuestion } from "@/hooks/useCurrentQuestion";
import { useCountdown } from "@/hooks/useCountdown";
import { useCountdownTo } from "@/hooks/useCountdownTo";
import { useTotalQuestions } from "@/hooks/useTotalQuestions";
import { useAllPacks } from "@/hooks/useAllPacks";
import { useCategoryVoteTally } from "@/hooks/useCategoryVoteTally";
import type { Player, Room } from "@/lib/types";

const CHOICE_STYLES = ["bg-rose-600", "bg-blue-600", "bg-amber-500", "bg-emerald-600"];

/** A compact, read-only live view of a room's progress — used wherever someone is watching without playing. */
export function LiveGameGlance({ room, players }: { room: Room; players: Player[] }) {
  const question = useCurrentQuestion(room.id, room.current_question_index, room.phase);
  const countdown = useCountdown(room.question_started_at, question?.time_limit_seconds ?? 15);
  const scheduledCountdown = useCountdownTo(room.starts_at);
  const totalQuestions = useTotalQuestions(room.id, room.phase);
  const packs = useAllPacks();
  const voteTally = useCategoryVoteTally(room.phase === "lobby" ? room.id : undefined);
  const sorted = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players]);

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col items-center gap-3">
      <p className="text-xs uppercase tracking-widest text-indigo-300">Live now</p>

      {room.phase === "lobby" && (
        <>
          <p className="text-sm text-indigo-200">
            {players.length} player{players.length === 1 ? "" : "s"} in the lobby
          </p>
          {room.starts_at && !scheduledCountdown.reached && (
            <p className="text-2xl font-black text-amber-400 tabular-nums">{scheduledCountdown.label}</p>
          )}
          {room.category_option_a && room.category_option_b && (
            <div className="w-full grid grid-cols-2 gap-2 mt-1">
              <VoteChip name={packs[room.category_option_a]?.name} count={voteTally.a} />
              <VoteChip name={packs[room.category_option_b]?.name} count={voteTally.b} />
            </div>
          )}
        </>
      )}

      {room.phase === "question" && question && (
        <>
          <p className="text-xs text-slate-400">
            Question {room.current_question_index + 1} of {totalQuestions || "?"} · {countdown.remainingSeconds}s
          </p>
          <p className="font-semibold text-center">{question.prompt}</p>
          <div className="grid grid-cols-2 gap-2 w-full">
            {(question.choices as string[]).map((choice, i) => (
              <div key={i} className={`${CHOICE_STYLES[i]} rounded-lg py-2 px-2 text-xs font-medium text-center`}>
                {choice}
              </div>
            ))}
          </div>
        </>
      )}

      {room.phase === "reveal" && question && (
        <>
          <p className="font-semibold text-center text-sm">{question.prompt}</p>
          <div className="grid grid-cols-2 gap-2 w-full">
            {(question.choices as string[]).map((choice, i) => (
              <div
                key={i}
                className={`${CHOICE_STYLES[i]} rounded-lg py-2 px-2 text-xs font-medium text-center ${
                  i === room.revealed_correct_index ? "ring-2 ring-white" : "opacity-40"
                }`}
              >
                {choice} {i === room.revealed_correct_index && "✓"}
              </div>
            ))}
          </div>
        </>
      )}

      {(room.phase === "leaderboard" || room.phase === "final") && (
        <div className="w-full flex flex-col gap-1.5">
          {room.phase === "final" && <p className="text-sm font-bold text-amber-400 mb-1">🎉 Final Results</p>}
          {sorted.slice(0, 5).map((p, i) => (
            <div key={p.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5 text-sm">
              <span>
                #{i + 1} {p.nickname}
              </span>
              <span className="text-amber-400 font-bold">{p.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VoteChip({ name, count }: { name: string | undefined; count: number }) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-center">
      <div className="text-xs font-semibold truncate">{name ?? "…"}</div>
      <div className="text-amber-400 font-bold text-sm">{count}</div>
    </div>
  );
}
