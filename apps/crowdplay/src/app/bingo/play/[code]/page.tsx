"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useBingoRoomRealtime } from "@/hooks/useBingoRoomRealtime";
import { useCountdown } from "@/hooks/useCountdown";
import { useCountdownTo } from "@/hooks/useCountdownTo";
import { CircularTimer } from "@/components/CircularTimer";
import { bingoPlayerKey, type BingoPlayerCredentials, type BingoSquare } from "@/lib/types";
import { haptics } from "@/lib/haptics";

const JOIN_ERRORS: Record<string, string> = {
  ROOM_NOT_FOUND: "That room code doesn't exist. Double check with your host.",
  INVALID_NICKNAME: "Enter a name between 1 and 30 characters.",
  NICKNAME_TAKEN: "Someone in this room already picked that name. Try another.",
  ROOM_FULL: "We've hit our 50 player limit for this beta round. Wait for the next game.",
};

function friendlyError(raw: string) {
  const key = Object.keys(JOIN_ERRORS).find((k) => raw.includes(k));
  return key ? JOIN_ERRORS[key] : "Something went wrong. Try again.";
}

const REVEAL_DWELL_SECONDS = 8;
const LEADERBOARD_DWELL_SECONDS = 8;

export default function BingoPlayPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code?.toUpperCase();
  const { room, players, loading, notFound } = useBingoRoomRealtime(code ?? null);
  const scheduledCountdown = useCountdownTo(room?.starts_at ?? null);
  const roundCountdown = useCountdown(
    room?.phase === "playing" ? room.phase_started_at : null,
    room?.round_duration_seconds ?? 300
  );
  const revealCountdown = useCountdown(room?.phase === "reveal" ? room.phase_started_at : null, REVEAL_DWELL_SECONDS);
  const leaderboardCountdown = useCountdown(
    room?.phase === "leaderboard" ? room.phase_started_at : null,
    LEADERBOARD_DWELL_SECONDS
  );

  const [creds, setCreds] = useState<BingoPlayerCredentials | null>(null);
  const [nickname, setNickname] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [confirmingQuit, setConfirmingQuit] = useState(false);

  useEffect(() => {
    if (!code) return;
    const raw = localStorage.getItem(bingoPlayerKey(code));
    if (raw) {
      try {
        setCreds(JSON.parse(raw));
      } catch {
        localStorage.removeItem(bingoPlayerKey(code));
      }
    }
  }, [code]);

  const me = useMemo(() => players.find((p) => p.id === creds?.playerId), [players, creds]);
  const sorted = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players]);
  const myRank = creds ? sorted.findIndex((p) => p.id === creds.playerId) + 1 : 0;
  const roomFull = players.length >= 50;

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    setJoining(true);
    setJoinError(null);
    const { data, error } = await supabase.rpc("join_bingo_room", { p_code: code, p_nickname: nickname });
    setJoining(false);
    if (error || !data?.[0]) {
      setJoinError(friendlyError(error?.message ?? ""));
      return;
    }
    const newCreds: BingoPlayerCredentials = {
      playerId: data[0].player_id,
      clientToken: data[0].client_token,
      roomId: data[0].room_id,
    };
    localStorage.setItem(bingoPlayerKey(code), JSON.stringify(newCreds));
    setCreds(newCreds);
  }

  async function markSquare(index: number) {
    if (!creds || !room) return;
    const square = (me?.card as unknown as BingoSquare[] | undefined)?.[index];
    if (!square || square.free) return;
    haptics.tap();
    const { data, error } = await supabase.rpc("mark_bingo_square", {
      p_room_id: room.id,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
      p_index: index,
    });
    if (error || !data?.[0]) return;
    if (data[0].o_won) haptics.correct();
  }

  function quit() {
    if (code) localStorage.removeItem(bingoPlayerKey(code));
    router.push("/bingo");
  }

  if (loading) return <Center text="Loading room…" />;
  if (notFound)
    return (
      <Center>
        <h1 className="text-xl font-bold mb-2">That room doesn&apos;t exist</h1>
        <p className="text-slate-400 max-w-xs">Double check the code with your host, or ask if there&#39;s a new one.</p>
      </Center>
    );
  if (!room) return null;

  if (!creds) {
    return (
      <Center>
        <h1 className="text-2xl font-bold mb-1">Room {room.code}</h1>
        <p className="text-slate-400 mb-6">Ready to play?</p>
        <form onSubmit={join} className="flex flex-col gap-3 w-full max-w-xs">
          {roomFull && (
            <p className="text-xs text-amber-400/80 -mt-1">
              This room is at capacity for our beta (50 players). Wait for the next game.
            </p>
          )}
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={30}
            placeholder="Your name"
            className="w-full text-center text-xl font-bold bg-white/10 border border-white/20 rounded-2xl py-4 outline-none focus:border-amber-400"
          />
          {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
          <button
            disabled={joining || nickname.trim().length === 0 || roomFull}
            className="rounded-2xl bg-amber-400 text-black font-bold text-lg py-4 disabled:opacity-40 active:scale-95 transition"
          >
            {joining ? "Joining…" : "Join Game"}
          </button>
        </form>
      </Center>
    );
  }

  if (room.phase === "lobby") {
    const showCountdown = room.starts_at && !scheduledCountdown.reached;
    return (
      <Center>
        <QuitButton onClick={() => setConfirmingQuit(true)} />
        <h1 className="text-2xl font-bold mb-2">You&apos;re in, {me?.nickname}!</h1>
        {showCountdown ? (
          <p className="text-slate-300 mb-1">
            Starting in <span className="text-amber-400 font-bold tabular-nums">{scheduledCountdown.label}</span>
          </p>
        ) : (
          <p className="text-slate-400 mb-1">Waiting for the host to start the game…</p>
        )}
        <p className="text-amber-400 font-semibold mt-4">
          {players.length} player{players.length === 1 ? "" : "s"} ready
        </p>
        <div className="flex flex-wrap gap-2 justify-center max-w-xs mt-3">
          {players.slice(-12).map((p) => (
            <span key={p.id} className="bg-white/10 rounded-full px-3 py-1 text-sm">
              {p.nickname}
            </span>
          ))}
        </div>
        {confirmingQuit && <QuitConfirm onCancel={() => setConfirmingQuit(false)} onConfirm={quit} />}
      </Center>
    );
  }

  if (room.phase === "playing") {
    const card = (me?.card as unknown as BingoSquare[] | undefined) ?? [];
    const marked = (me?.marked as unknown as boolean[] | undefined) ?? [];
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center px-4 py-6">
        <QuitButton onClick={() => setConfirmingQuit(true)} />
        <div className="flex items-center gap-3 mb-4">
          <CircularTimer fraction={roundCountdown.fraction} label={roundCountdown.remainingSeconds} />
          <div className="text-left">
            <p className="text-sm text-slate-400">Round {room.current_round_index} of {room.total_rounds}</p>
            <p className="text-xs text-slate-500">Tap a square once you&apos;ve done it</p>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-1.5 w-full max-w-md">
          {card.map((square, i) => (
            <button
              key={i}
              onClick={() => markSquare(i)}
              disabled={square.free}
              className={`aspect-square rounded-md p-1 text-[9px] leading-tight font-semibold flex items-center justify-center text-center transition active:scale-95 ${
                marked[i]
                  ? "bg-amber-400 text-black"
                  : square.free
                    ? "bg-white/20 text-white"
                    : "bg-white/10 text-slate-200 hover:bg-white/15"
              }`}
            >
              {square.text}
            </button>
          ))}
        </div>
        {confirmingQuit && <QuitConfirm onCancel={() => setConfirmingQuit(false)} onConfirm={quit} />}
      </main>
    );
  }

  if (room.phase === "reveal") {
    const winner = players.find((p) => p.id === room.winner_player_id);
    return (
      <Center>
        <QuitButton onClick={() => setConfirmingQuit(true)} />
        <div className="mb-4">
          <CircularTimer fraction={revealCountdown.fraction} size={56} />
        </div>
        {winner ? (
          <>
            <h1 className="text-3xl font-black text-amber-400 mb-2">Bingo!</h1>
            <p className="text-xl">{winner.nickname} got it first</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-2">Time&apos;s up</h1>
            <p className="text-slate-400">Nobody completed a line this round</p>
          </>
        )}
        {confirmingQuit && <QuitConfirm onCancel={() => setConfirmingQuit(false)} onConfirm={quit} />}
      </Center>
    );
  }

  if (room.phase === "leaderboard" || room.phase === "final") {
    return (
      <Center>
        {room.phase === "leaderboard" && <QuitButton onClick={() => setConfirmingQuit(true)} />}
        <div className="flex items-center gap-3 mb-2">
          {room.phase === "leaderboard" && <CircularTimer fraction={leaderboardCountdown.fraction} size={32} strokeWidth={3} />}
          <h1 className="text-2xl font-bold">{room.phase === "final" ? "Final Results" : "Leaderboard"}</h1>
        </div>
        <p className="text-slate-400 mb-6">
          You&apos;re #{myRank || "-"} with {me?.score ?? 0} points
        </p>
        <div className="w-full max-w-xs flex flex-col gap-2">
          {sorted.slice(0, 5).map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center justify-between rounded-xl px-4 py-2 ${
                p.id === creds.playerId ? "bg-amber-400/20 border border-amber-400/40" : "bg-white/5"
              }`}
            >
              <span className="font-semibold">
                {i + 1}. {p.nickname}
              </span>
              <span className="text-amber-400 font-bold">{p.score}</span>
            </div>
          ))}
        </div>
        {room.phase === "final" && <p className="text-xs text-slate-500 mt-6 max-w-xs">Next game boarding shortly…</p>}
      </Center>
    );
  }

  return null;
}

function Center({ text, children }: { text?: string; children?: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-1 bg-slate-950 text-white px-6 text-center">
      {text ? <p className="text-slate-400">{text}</p> : children}
    </main>
  );
}

function QuitButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="fixed top-4 left-4 text-xs text-slate-500 hover:text-slate-300">
      Leave game
    </button>
  );
}

function QuitConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center px-6 z-10">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-xs text-center">
        <p className="mb-4">Leave this game? You&apos;ll lose your spot and progress.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-xl bg-white/10 py-2 font-semibold">
            Stay
          </button>
          <button onClick={onConfirm} className="flex-1 rounded-xl bg-red-500 py-2 font-semibold">
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
