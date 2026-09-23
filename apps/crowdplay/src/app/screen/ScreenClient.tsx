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
import { ScreenAgent } from "@/components/ScreenAgent";
import { useScreenVenue } from "@/lib/venue";
import { CategoryIcon } from "@/components/CategoryIcon";
import { supabase } from "@/lib/supabase";
import type { Team, FinalRecapRow } from "@/lib/types";

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
  const venue = useScreenVenue();
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
    return (
      <>
        <ScreenAgent venue={venue} page="/screen" />
        <FullscreenMessage text="Waiting for the next game…" />
      </>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col">
      <ScreenAgent venue={venue} page="/screen" />
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
            <JoinQRCode code={room.code} venue={venue} />
            {room.starts_at && !scheduledCountdown.reached && (
              <p className="text-lg text-slate-300">
                Starting in <span className="text-amber-400 font-bold tabular-nums">{scheduledCountdown.label}</span>
              </p>
            )}
            {room.category_options && room.category_options.length > 0 && (
              <div className="w-full max-w-md">
                <p className="text-sm text-slate-400 mb-2">Voting on the category:</p>
                <div className="grid grid-cols-2 gap-2">
                  {room.category_options.map((packId) => (
                    <VoteOption
                      key={packId}
                      name={packs[packId]?.name}
                      icon={packs[packId]?.icon}
                      count={voteTally[packId] ?? 0}
                    />
                  ))}
                </div>
              </div>
            )}
            {teams.length > 0 && (
              <div className="w-full max-w-4xl">
                <p className="text-sm uppercase tracking-widest text-slate-400 mb-3">
                  {teams.length} team{teams.length === 1 ? "" : "s"} playing
                </p>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-left">
                  {teams.map((t) => {
                    const members = activePlayers.filter((p) => p.team_id === t.id);
                    return (
                      <div key={t.id} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                        <p className="font-bold text-lg">
                          {t.name} <span className="text-sm font-normal text-slate-400">({members.length}/4)</span>
                        </p>
                        <p className="text-sm text-slate-300">{members.map((p) => p.nickname).join(", ")}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
            <p className="text-2xl text-amber-400">Teams are typing their answers now</p>
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

function VoteOption({
  name,
  icon,
  count,
}: {
  name: string | undefined;
  icon: string | null | undefined;
  count: number;
}) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
      <CategoryIcon slug={icon} className="w-5 h-5 mb-1 text-amber-400" />
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
    const map = new Map<number, { prompt: string; correctAnswer: string }>();
    for (const r of recap) {
      if (!map.has(r.o_question_order)) {
        map.set(r.o_question_order, { prompt: r.o_prompt, correctAnswer: r.o_correct_answer });
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
          <p className="text-sm text-emerald-400">Correct: {q.correctAnswer}</p>
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
