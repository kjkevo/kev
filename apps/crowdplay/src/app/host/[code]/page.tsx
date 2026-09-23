"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
import { useCurrentQuestion } from "@/hooks/useCurrentQuestion";
import { useCountdown } from "@/hooks/useCountdown";
import { useCountdownTo } from "@/hooks/useCountdownTo";
import { useAnsweredCount } from "@/hooks/useAnsweredCount";
import { useTotalQuestions } from "@/hooks/useTotalQuestions";
import { useAllPacks } from "@/hooks/useAllPacks";
import { useCategoryVoteTally } from "@/hooks/useCategoryVoteTally";
import { JoinQRCode } from "@/components/JoinQRCode";
import { CategoryIcon } from "@/components/CategoryIcon";
import { hostKey, type HostCredentials, type Team, type FinalRecapRow } from "@/lib/types";

export default function HostGamePage() {
  const params = useParams<{ code: string }>();
  const code = params.code?.toUpperCase();
  const { room, players, teams, loading, notFound } = useRoomRealtime(code ?? null);
  const question = useCurrentQuestion(room?.id, room?.current_question_index, room?.phase);
  const countdown = useCountdown(room?.question_started_at ?? null, question?.time_limit_seconds ?? 15);
  const scheduledCountdown = useCountdownTo(room?.starts_at ?? null);
  const votedCount = useAnsweredCount(room?.phase === "question" ? question?.id : undefined);
  const totalQuestions = useTotalQuestions(room?.id, room?.phase);
  const packs = useAllPacks();
  const voteTally = useCategoryVoteTally(room?.phase === "lobby" ? room?.id : undefined);

  const [creds, setCreds] = useState<HostCredentials | null>(null);
  const [busy, setBusy] = useState(false);
  const [recap, setRecap] = useState<FinalRecapRow[] | null>(null);

  useEffect(() => {
    if (!code) return;
    const raw = localStorage.getItem(hostKey(code));
    if (raw) setCreds(JSON.parse(raw));
  }, [code]);

  useEffect(() => {
    if (room?.phase !== "final" || !room.id || recap) return;
    supabase.rpc("get_final_recap", { p_room_id: room.id }).then(({ data }) => {
      if (data) setRecap(data as FinalRecapRow[]);
    });
  }, [room?.phase, room?.id, recap]);

  // "Active" excludes anyone who's left -- used for the roster/header count
  // and the votes-cast denominator. The standings keep every team
  // (including ones whose members left), since a score already earned
  // shouldn't just vanish.
  const activePlayers = useMemo(() => players.filter((p) => !p.left_at), [players]);
  const sortedTeams = useMemo(() => [...teams].sort((a, b) => b.score - a.score), [teams]);

  async function act(fn: () => Promise<{ error: Error | null }>) {
    if (!room || !creds || busy) return;
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) alert(error.message);
  }

  const start = () =>
    act(async () => {
      const { error } = await supabase.rpc("start_room", {
        p_room_id: room!.id,
        p_host_secret: creds!.hostSecret,
      });
      return { error };
    });

  const advance = (action: "next_question" | "end") =>
    act(async () => {
      const { error } = await supabase.rpc("advance_phase", {
        p_room_id: room!.id,
        p_host_secret: creds!.hostSecret,
        p_action: action,
      });
      return { error };
    });

  // The host's own open tab is what actually flips the switch when a
  // scheduled countdown hits zero — there's no server-side cron in this
  // MVP, so "it starts itself" only holds while the host screen is open,
  // which is the reasonable assumption for someone running the show.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (
      room?.phase === "lobby" &&
      room.starts_at &&
      scheduledCountdown.reached &&
      !autoStartedRef.current &&
      creds
    ) {
      autoStartedRef.current = true;
      start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.phase, room?.starts_at, scheduledCountdown.reached, creds]);

  if (loading) return <FullscreenMessage text="Loading room…" />;
  if (notFound) return <FullscreenMessage text="That room doesn't exist anymore. Head to /host to start a new one." />;
  if (!creds) {
    return (
      <FullscreenMessage text="This screen isn't recognized as the host for this room (wrong device, or storage was cleared). Create a new room from /host." />
    );
  }
  if (!room) return null;

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
                Auto-starting in <span className="text-amber-400 font-bold tabular-nums">{scheduledCountdown.label}</span>
              </p>
            )}

            {room.category_options && room.category_options.length > 0 && (
              <div className="w-full max-w-md">
                <p className="text-sm text-slate-400 mb-2">Players are voting on the category:</p>
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

            <div className="flex flex-wrap gap-3 justify-center max-w-2xl">
              {teams.map((t) => (
                <TeamChip key={t.id} team={t} memberCount={activePlayers.filter((p) => p.team_id === t.id).length} />
              ))}
            </div>
            <button
              onClick={start}
              disabled={busy || activePlayers.length === 0}
              className="mt-4 rounded-2xl bg-amber-400 text-black font-bold text-2xl px-10 py-5 disabled:opacity-40"
            >
              {room.starts_at && !scheduledCountdown.reached ? "Start Now" : "Start Game"}
            </button>
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
            <p className="text-lg text-amber-400">Teams are typing their answers now</p>
            <p className="text-slate-400">
              {votedCount} of {activePlayers.length} votes cast &middot; results reveal at the end
            </p>
            <button
              onClick={() => advance("next_question")}
              disabled={busy}
              className="rounded-2xl bg-white/10 border border-white/20 font-bold text-xl px-8 py-4"
            >
              Next Question
            </button>
            <button onClick={() => advance("end")} disabled={busy} className="text-sm text-slate-500 underline">
              End game now
            </button>
          </>
        )}

        {room.phase === "final" && (
          <>
            <h2 className="text-4xl font-black text-amber-400">Final Results</h2>
            <TeamStandings teams={sortedTeams} />
            {recap && <Recap recap={recap} />}
            <Link
              href="/host"
              className="mt-6 inline-block rounded-2xl bg-white/10 border border-white/20 font-bold text-xl px-8 py-4"
            >
              Start Another Round
            </Link>
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

function TeamChip({ team, memberCount }: { team: Team; memberCount: number }) {
  return (
    <span className="bg-white/10 rounded-full px-4 py-2 text-lg">
      {team.name}
      <span className="text-xs text-slate-400 ml-2">
        ({memberCount}/4{team.kind === "self" && memberCount < 3 ? ", needs more" : ""})
      </span>
    </span>
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
    <div className="w-full max-w-2xl flex flex-col gap-2 max-h-80 overflow-y-auto text-left">
      <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Question recap</p>
      {byQuestion.map(([order, q]) => (
        <div key={order} className="rounded-xl bg-white/5 px-5 py-3">
          <p className="font-semibold mb-1">{q.prompt}</p>
          <p className="text-sm text-emerald-400 mb-1">Correct: {q.correctAnswer}</p>
          <p className="text-xs text-slate-400">
            {recap
              .filter((r) => r.o_question_order === order && r.o_team_name)
              .map((r) => `${r.o_team_name} (${r.o_team_correct ? "correct" : "wrong"})`)
              .join(", ")}
          </p>
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
