"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
import { useCurrentQuestion } from "@/hooks/useCurrentQuestion";
import { useCountdown } from "@/hooks/useCountdown";
import { JoinQRCode } from "@/components/JoinQRCode";
import { hostKey, type HostCredentials } from "@/lib/types";

const CHOICE_STYLES = [
  "bg-rose-600",
  "bg-blue-600",
  "bg-amber-500",
  "bg-emerald-600",
];

export default function HostGamePage() {
  const params = useParams<{ code: string }>();
  const code = params.code?.toUpperCase();
  const { room, players, loading, notFound } = useRoomRealtime(code ?? null);
  const question = useCurrentQuestion(room?.pack_id, room?.current_question_index);
  const countdown = useCountdown(room?.question_started_at ?? null, question?.time_limit_seconds ?? 15);

  const [creds, setCreds] = useState<HostCredentials | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!code) return;
    const raw = localStorage.getItem(hostKey(code));
    if (raw) setCreds(JSON.parse(raw));
  }, [code]);

  // Live "N of M answered" counter for the current question.
  useEffect(() => {
    if (!room || room.phase !== "question" || !question) {
      setAnsweredCount(0);
      return;
    }
    let cancelled = false;
    const refresh = () =>
      supabase
        .from("answers")
        .select("id", { count: "exact", head: true })
        .eq("question_id", question.id)
        .then(({ count }) => {
          if (!cancelled) setAnsweredCount(count ?? 0);
        });
    refresh();
    const channel = supabase
      .channel(`answers:${question.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "answers", filter: `question_id=eq.${question.id}` },
        () => refresh()
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [room?.phase, question?.id]);

  const sortedPlayers = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players]);

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

  const advance = (action: "reveal" | "leaderboard" | "next_question" | "end") =>
    act(async () => {
      const { error } = await supabase.rpc("advance_phase", {
        p_room_id: room!.id,
        p_host_secret: creds!.hostSecret,
        p_action: action,
      });
      return { error };
    });

  if (loading) return <FullscreenMessage text="Loading room…" />;
  if (notFound) return <FullscreenMessage text="Room not found." />;
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
          {sortedPlayers.length} player{sortedPlayers.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 text-center gap-8">
        {room.phase === "lobby" && (
          <>
            <p className="text-2xl text-slate-300">Join at</p>
            <p className="text-5xl font-black tracking-widest text-amber-400">{room.code}</p>
            <JoinQRCode code={room.code} />
            <div className="flex flex-wrap gap-3 justify-center max-w-2xl">
              {sortedPlayers.map((p) => (
                <span key={p.id} className="bg-white/10 rounded-full px-4 py-2 text-lg">
                  {p.nickname}
                </span>
              ))}
            </div>
            <button
              onClick={start}
              disabled={busy || sortedPlayers.length === 0}
              className="mt-4 rounded-2xl bg-amber-400 text-black font-bold text-2xl px-10 py-5 disabled:opacity-40"
            >
              Start Game
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
              Question {room.current_question_index + 1} · {countdown.remainingSeconds}s
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
              {answeredCount} of {sortedPlayers.length} answered
            </p>
            <button
              onClick={() => advance("reveal")}
              disabled={busy}
              className="rounded-2xl bg-white/10 border border-white/20 font-bold text-xl px-8 py-4"
            >
              Reveal Answer
            </button>
          </>
        )}

        {room.phase === "reveal" && question && (
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
                  {choice} {i === room.revealed_correct_index && "✓"}
                </div>
              ))}
            </div>
            <button
              onClick={() => advance("leaderboard")}
              disabled={busy}
              className="rounded-2xl bg-amber-400 text-black font-bold text-2xl px-10 py-5"
            >
              Show Leaderboard
            </button>
          </>
        )}

        {room.phase === "leaderboard" && (
          <Leaderboard
            players={sortedPlayers}
            action={
              <button
                onClick={() => advance("next_question")}
                disabled={busy}
                className="rounded-2xl bg-amber-400 text-black font-bold text-2xl px-10 py-5"
              >
                Next Question
              </button>
            }
          />
        )}

        {room.phase === "final" && (
          <>
            <h2 className="text-4xl font-black text-amber-400">🎉 Final Results 🎉</h2>
            <Leaderboard players={sortedPlayers} />
          </>
        )}
      </div>
    </main>
  );
}

function Leaderboard({ players, action }: { players: { id: string; nickname: string; score: number }[]; action?: React.ReactNode }) {
  return (
    <div className="w-full max-w-lg flex flex-col gap-2">
      {players.slice(0, 10).map((p, i) => (
        <div
          key={p.id}
          className="flex items-center justify-between bg-white/5 rounded-xl px-5 py-3 text-lg"
        >
          <span className="font-semibold">
            #{i + 1} {p.nickname}
          </span>
          <span className="text-amber-400 font-bold">{p.score}</span>
        </div>
      ))}
      {action && <div className="mt-6">{action}</div>}
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
