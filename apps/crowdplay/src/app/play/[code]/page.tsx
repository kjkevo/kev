"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
import { useCurrentQuestion } from "@/hooks/useCurrentQuestion";
import { useCountdown } from "@/hooks/useCountdown";
import { playerKey, type PlayerCredentials } from "@/lib/types";

const CHOICE_STYLES = ["bg-rose-600", "bg-blue-600", "bg-amber-500", "bg-emerald-600"];

const JOIN_ERRORS: Record<string, string> = {
  ROOM_NOT_FOUND: "That room code doesn't exist. Double check with your host.",
  ROOM_ALREADY_STARTED: "This game already started — ask your host to make you a new room, or wait for the next one.",
  INVALID_NICKNAME: "Enter a name between 1 and 20 characters.",
  NICKNAME_TAKEN: "Someone in this room already picked that name — try another.",
};

function friendlyError(raw: string) {
  const key = Object.keys(JOIN_ERRORS).find((k) => raw.includes(k));
  return key ? JOIN_ERRORS[key] : "Something went wrong. Try again.";
}

export default function PlayPage() {
  const params = useParams<{ code: string }>();
  const code = params.code?.toUpperCase();
  const { room, players, loading, notFound } = useRoomRealtime(code ?? null);
  const question = useCurrentQuestion(room?.pack_id, room?.current_question_index);
  const countdown = useCountdown(room?.question_started_at ?? null, question?.time_limit_seconds ?? 15);

  const [creds, setCreds] = useState<PlayerCredentials | null>(null);
  const [nickname, setNickname] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; points: number } | null>(null);

  useEffect(() => {
    if (!code) return;
    const raw = localStorage.getItem(playerKey(code));
    if (raw) setCreds(JSON.parse(raw));
  }, [code]);

  // Reset per-question answer state whenever the room moves to a new question.
  useEffect(() => {
    setPicked(null);
    setResult(null);
  }, [room?.current_question_index]);

  const me = useMemo(() => players.find((p) => p.id === creds?.playerId), [players, creds]);
  const sorted = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players]);
  const myRank = useMemo(() => sorted.findIndex((p) => p.id === creds?.playerId) + 1, [sorted, creds]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!code || nickname.trim().length === 0) return;
    setJoining(true);
    setJoinError(null);
    const { data, error } = await supabase.rpc("join_room", { p_code: code, p_nickname: nickname.trim() });
    setJoining(false);
    if (error || !data?.[0]) {
      setJoinError(friendlyError(error?.message ?? ""));
      return;
    }
    const c: PlayerCredentials = {
      playerId: data[0].player_id,
      clientToken: data[0].client_token,
      roomId: data[0].room_id,
    };
    localStorage.setItem(playerKey(code), JSON.stringify(c));
    setCreds(c);
  }

  async function answer(index: number) {
    if (!room || !creds || !question || picked !== null || countdown.expired) return;
    setPicked(index);
    const { data, error } = await supabase.rpc("submit_answer", {
      p_room_id: room.id,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
      p_question_id: question.id,
      p_choice_index: index,
    });
    if (error || !data?.[0]) return; // stale/time-expired — UI just shows "locked in"
    setResult({ correct: data[0].correct, points: data[0].points_awarded });
  }

  if (loading) return <Center text="Loading room…" />;
  if (notFound) return <Center text="That room doesn't exist. Check the code with your host." />;
  if (!room) return null;

  if (!creds) {
    return (
      <Center>
        <h1 className="text-2xl font-bold mb-1">Room {room.code}</h1>
        <p className="text-slate-400 mb-6">Pick a name to join</p>
        <form onSubmit={join} className="flex flex-col gap-3 w-full max-w-xs">
          <input
            autoFocus
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            placeholder="Your name"
            className="text-center text-xl font-bold bg-white/10 border border-white/20 rounded-2xl py-4 outline-none focus:border-amber-400"
          />
          {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
          <button
            disabled={joining || nickname.trim().length === 0}
            className="rounded-2xl bg-amber-400 text-black font-bold text-lg py-4 disabled:opacity-40 active:scale-95 transition"
          >
            {joining ? "Joining…" : "Join Game"}
          </button>
        </form>
      </Center>
    );
  }

  if (room.phase === "lobby") {
    return (
      <Center>
        <p className="text-4xl mb-4">🎉</p>
        <h1 className="text-2xl font-bold mb-2">You&apos;re in, {me?.nickname}!</h1>
        <p className="text-slate-400">Waiting for the host to start the game…</p>
      </Center>
    );
  }

  if (room.phase === "question" && question) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col px-5 py-6">
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-4">
          <div className="h-full bg-amber-400 transition-[width] duration-100 linear" style={{ width: `${countdown.fraction * 100}%` }} />
        </div>
        <h2 className="text-xl font-bold mb-6 text-center">{question.prompt}</h2>
        <div className="flex-1 grid grid-cols-1 gap-3">
          {(question.choices as string[]).map((choice, i) => (
            <button
              key={i}
              onClick={() => answer(i)}
              disabled={picked !== null || countdown.expired}
              className={`${CHOICE_STYLES[i]} rounded-2xl py-6 px-4 text-lg font-semibold text-left disabled:opacity-40 ${
                picked === i ? "ring-4 ring-white" : ""
              }`}
            >
              {choice}
            </button>
          ))}
        </div>
        <p className="text-center text-slate-400 mt-4">
          {picked !== null ? "Answer locked in!" : countdown.expired ? "Time's up!" : "Tap your answer"}
        </p>
      </main>
    );
  }

  if (room.phase === "reveal" && question) {
    return (
      <Center>
        {picked === null ? (
          <p className="text-2xl font-bold">Time&apos;s up — no answer submitted</p>
        ) : result ? (
          <>
            <p className="text-5xl mb-3">{result.correct ? "✅" : "❌"}</p>
            <h1 className="text-2xl font-bold">{result.correct ? "Correct!" : "Not quite"}</h1>
            {result.points > 0 && <p className="text-amber-400 text-xl mt-1">+{result.points} points</p>}
          </>
        ) : (
          <p className="text-xl">Checking your answer…</p>
        )}
      </Center>
    );
  }

  if (room.phase === "leaderboard" || room.phase === "final") {
    return (
      <Center>
        <h1 className="text-2xl font-bold mb-1">
          {room.phase === "final" ? "🎉 Final Results" : "Leaderboard"}
        </h1>
        <p className="text-slate-400 mb-6">
          You&apos;re #{myRank || "-"} with {me?.score ?? 0} points
        </p>
        <div className="w-full max-w-xs flex flex-col gap-2">
          {sorted.slice(0, 5).map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center justify-between rounded-xl px-4 py-2 ${
                p.id === creds.playerId ? "bg-amber-400 text-black font-bold" : "bg-white/5"
              }`}
            >
              <span>#{i + 1} {p.nickname}</span>
              <span>{p.score}</span>
            </div>
          ))}
        </div>
      </Center>
    );
  }

  return null;
}

function Center({ text, children }: { text?: string; children?: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white flex flex-col items-center justify-center px-6 text-center">
      {text ?? children}
    </main>
  );
}
