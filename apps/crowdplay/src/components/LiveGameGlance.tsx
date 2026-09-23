"use client";

import { useMemo } from "react";
import { useCurrentQuestion } from "@/hooks/useCurrentQuestion";
import { useCountdown } from "@/hooks/useCountdown";
import { useCountdownTo } from "@/hooks/useCountdownTo";
import { useTotalQuestions } from "@/hooks/useTotalQuestions";
import { useAllPacks } from "@/hooks/useAllPacks";
import { useCategoryVoteTally } from "@/hooks/useCategoryVoteTally";
import type { Player, Room, Team } from "@/lib/types";

/** A compact, read-only live view of a room's progress — used wherever someone is watching without playing. */
export function LiveGameGlance({ room, players, teams }: { room: Room; players: Player[]; teams: Team[] }) {
  const question = useCurrentQuestion(room.id, room.current_question_index, room.phase);
  const countdown = useCountdown(room.question_started_at, question?.time_limit_seconds ?? 15);
  const scheduledCountdown = useCountdownTo(room.starts_at);
  const totalQuestions = useTotalQuestions(room.id, room.phase);
  const packs = useAllPacks();
  const voteTally = useCategoryVoteTally(room.phase === "lobby" ? room.id : undefined);
  // "Active" excludes anyone who's left -- the standings keep every team,
  // since a score already earned shouldn't just vanish.
  const activePlayers = useMemo(() => players.filter((p) => !p.left_at), [players]);
  const sortedTeams = useMemo(() => [...teams].sort((a, b) => b.score - a.score), [teams]);

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col items-center gap-3">
      <p className="text-xs uppercase tracking-widest text-indigo-300">Live now</p>

      {room.phase === "lobby" && (
        <>
          <p className="text-sm text-indigo-200">
            {activePlayers.length} player{activePlayers.length === 1 ? "" : "s"} in the lobby
          </p>
          {room.starts_at && !scheduledCountdown.reached && (
            <p className="text-2xl font-black text-amber-400 tabular-nums">{scheduledCountdown.label}</p>
          )}
          {room.category_options && room.category_options.length > 0 && (
            <div className="w-full grid grid-cols-2 gap-2 mt-1">
              {room.category_options.slice(0, 4).map((packId) => (
                <VoteChip key={packId} name={packs[packId]?.name} count={voteTally[packId] ?? 0} />
              ))}
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
          <p className="text-xs text-slate-500">Teams are typing their answers. Results reveal at the end</p>
        </>
      )}

      {room.phase === "final" && (
        <div className="w-full flex flex-col gap-1.5">
          <p className="text-sm font-bold text-amber-400 mb-1">Final Results</p>
          {sortedTeams.slice(0, 5).map((t, i) => (
            <div key={t.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5 text-sm">
              <span>
                #{i + 1} {t.name}
              </span>
              <span className="text-amber-400 font-bold">{t.score}</span>
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
