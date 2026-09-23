"use client";

import { useEffect, useMemo, useState } from "react";
import { useActiveRoom } from "@/hooks/useActiveRoom";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
import { useCurrentQuestion } from "@/hooks/useCurrentQuestion";
import { useCountdown } from "@/hooks/useCountdown";
import { useCountdownTo } from "@/hooks/useCountdownTo";
import { useTotalQuestions } from "@/hooks/useTotalQuestions";
import { useAnsweredCount } from "@/hooks/useAnsweredCount";
import { useAllPacks } from "@/hooks/useAllPacks";
import { useCategoryVoteTally } from "@/hooks/useCategoryVoteTally";
import { JoinQRCode } from "@/components/JoinQRCode";
import { supabase } from "@/lib/supabase";
import type { Team, FinalRecapRow } from "@/lib/types";

const CHOICE_STYLES = ["bg-rose-600", "bg-blue-600", "bg-amber-500", "bg-emerald-600"];

/**
 * The venue's TV/projector view — leave this open all night. It always
 * follows whatever game is currently active (no room code needed) and is
 * pure spectator: no buttons, nothing to click. The database's autonomous
 * ticker drives every phase change on its own, so this page just reflects
 * whatever's true right now, the same as any player's phone would. Scoring
 * is team-based and hidden until the game actually ends, so this screen
 * never shows a per-question correct answer or a mid-game leaderboard —
 * just the live question and vote count, then the full recap at the end.
 */
export default function ScreenClient() {
  const activeRoom = useActiveRoom();
  const code = activeRoom?.code ?? null;
  const { room, players, teams } = useRoomRealtime(code);
  const question = useCurrentQuestion(room?.id, room?.current_question_index, room?.phase);
  const countdown = useCountdown(room?.question_started_at ?? null, question?.time_limit_seconds ?? 15);
  const scheduledCountdown = useCountdownTo(room?.starts_at ?? null);
  const totalQuestions = useTotalQuestions(room?.id, room?.phase);
  const votedCount = useAnsweredCount(room?.phase === "question" ? question?.id : undefined);
  const packs = useAllPacks();
  const voteTally = useCategoryVoteTally(room?.phase === "lobby" ? room?.id : undefined);
  const [recap, setRecap] = useState<FinalRecapRow[] | null>(null);

  // "Active" excludes anyone who's left -- the standings keep every team
  // (including ones whose members left), since a score already earned
  // shouldn't just vanish.
  const activePlayers = useMemo(() => players.filter((p) => !p.left_at), [players]);
  const sortedTeams = useMemo(() => [...teams].sort((a, b) => b.score - a.score), [teams]);

  useEffect(() => {
    if (room?.phase !== "final" || !room.id) {
      setRecap(null);
      return;
    }
    supabase.rpc("get_final_recap", { p_room_id: room.id }).then(({ data }) => {
      if (data) setRecap(data as FinalRecapRow[]);
    });
  }, [room?.phase, room?.id]);

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
          {activePlayers.length} player{activePlayers.length === 1 ? "" : "s"} · {teams.length} team
          {teams.length === 1 ? "" : "s"}
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
              {teams.map((t) => (
                <span key={t.id} className="bg-white/10 rounded-full px-4 py-2 text-lg">
                  {t.name}{" "}
                  <span className="text-sm text-slate-400">
                    ({activePlayers.filter((p) => p.team_id === t.id).length}/4)
                  </span>
                </span>
              ))}
            </div>
          </>
        )}

        {room.phase === "question" && question && (
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
            <p className="text-slate-400">
              {votedCount} of {activePlayers.length} votes cast &middot; results reveal at the end
            </p>
          </>
        )}

        {room.phase === "final" && (
          <>
            <h2 className="text-4xl font-black text-amber-400">Final Results</h2>
            <TeamStandings teams={sortedTeams} />
            {recap && <Recap recap={recap} />}
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

function TeamStandings({ teams }: { teams: Team[] }) {
  return (
    <div className="w-full max-w-lg flex flex-col gap-2">
      {teams.slice(0, 10).map((t, i) => (
        <div key={t.id} className="flex items-center justify-between bg-white/5 rounded-xl px-5 py-3 text-lg">
          <span className="font-semibold">
            #{i + 1} {t.name}
          </span>
          <span className="text-amber-400 font-bold">{t.score}</span>
        </div>
      ))}
    </div>
  );
}

function Recap({ recap }: { recap: FinalRecapRow[] }) {
  const byQuestion = useMemo(() => {
    const map = new Map<number, { prompt: string; choices: string[]; correctIndex: number }>();
    for (const r of recap) {
      if (!map.has(r.o_question_order)) {
        map.set(r.o_question_order, { prompt: r.o_prompt, choices: r.o_choices, correctIndex: r.o_correct_index });
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [recap]);

  return (
    <div className="w-full max-w-2xl flex flex-col gap-2 max-h-72 overflow-y-auto text-left">
      <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Question recap</p>
      {byQuestion.map(([order, q]) => (
        <div key={order} className="rounded-xl bg-white/5 px-5 py-3">
          <p className="font-semibold mb-1">{q.prompt}</p>
          <p className="text-sm text-emerald-400">Correct: {q.choices[q.correctIndex]}</p>
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
