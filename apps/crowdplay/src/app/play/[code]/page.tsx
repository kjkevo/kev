"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
import { useCurrentQuestion } from "@/hooks/useCurrentQuestion";
import { useCountdown } from "@/hooks/useCountdown";
import { useCountdownTo } from "@/hooks/useCountdownTo";
import { useTotalQuestions } from "@/hooks/useTotalQuestions";
import { useAnsweredCount } from "@/hooks/useAnsweredCount";
import { useAllPacks } from "@/hooks/useAllPacks";
import { useCategoryVoteTally } from "@/hooks/useCategoryVoteTally";
import { playerKey, type PlayerCredentials, type Player } from "@/lib/types";
import { randomFunName } from "@/lib/funNames";
import { haptics } from "@/lib/haptics";

const CHOICE_STYLES = ["bg-rose-600", "bg-blue-600", "bg-amber-500", "bg-emerald-600"];

const JOIN_ERRORS: Record<string, string> = {
  ROOM_NOT_FOUND: "That room code doesn't exist. Double check with your host.",
  ROOM_ALREADY_STARTED: "This game already started. Ask your host to make you a new room, or wait for the next one.",
  INVALID_NICKNAME: "Enter a name between 1 and 30 characters.",
  NICKNAME_TAKEN: "Someone in this room already picked that name. Try another.",
  ROOM_FULL_TEAMS: "We've hit our 20 team limit for this beta round. Try joining solo, or wait for the next game.",
  ROOM_FULL_SOLO: "We've hit our 50 player limit for this beta round. Wait for the next game to join in.",
};

function friendlyError(raw: string) {
  const key = Object.keys(JOIN_ERRORS).find((k) => raw.includes(k));
  return key ? JOIN_ERRORS[key] : "Something went wrong. Try again.";
}

export default function PlayPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code?.toUpperCase();
  const { room, players, loading, notFound } = useRoomRealtime(code ?? null);
  const question = useCurrentQuestion(room?.id, room?.current_question_index, room?.phase);
  const countdown = useCountdown(room?.question_started_at ?? null, question?.time_limit_seconds ?? 15);
  const scheduledCountdown = useCountdownTo(room?.starts_at ?? null);
  const totalQuestions = useTotalQuestions(room?.id, room?.phase);
  const answeredCount = useAnsweredCount(room?.phase === "question" ? question?.id : undefined);
  const packs = useAllPacks();
  const voteTally = useCategoryVoteTally(room?.phase === "lobby" ? room?.id : undefined);
  // Realtime confirmation typically lands well under a second, but the tap
  // should feel instant regardless — bump the shown count immediately and
  // let the next real tally (which will already agree) replace it.
  const [displayTally, setDisplayTally] = useState(voteTally);
  useEffect(() => setDisplayTally(voteTally), [voteTally.a, voteTally.b]);

  const [creds, setCreds] = useState<PlayerCredentials | null>(null);
  const [nickname, setNickname] = useState("");
  const [isTeam, setIsTeam] = useState(false);
  const [teammates, setTeammates] = useState<string[]>([""]);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; points: number } | null>(null);
  const [myVote, setMyVote] = useState<0 | 1 | null>(null);
  const [confirmingQuit, setConfirmingQuit] = useState(false);

  useEffect(() => {
    setNickname(randomFunName());
  }, []);

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

  // Reset vote choice whenever a fresh room (new code) shows up.
  useEffect(() => {
    setMyVote(null);
  }, [room?.id]);

  // A buzz the instant the verdict lands feels immediate even in a loud room
  // where the screen alone might not register right away.
  useEffect(() => {
    if (!result) return;
    if (result.correct) haptics.correct();
    else haptics.wrong();
  }, [result]);

  const teamCount = useMemo(
    () => players.filter((p) => p.team_members && p.team_members.length > 0).length,
    [players]
  );
  const soloCount = players.length - teamCount;
  const teamsFull = teamCount >= 20;
  const soloFull = soloCount >= 50;

  const me = useMemo(() => players.find((p) => p.id === creds?.playerId), [players, creds]);
  const sorted = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players]);
  const myRank = useMemo(() => sorted.findIndex((p) => p.id === creds?.playerId) + 1, [sorted, creds]);
  const recentJoiners = useMemo(
    () => [...players].sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime()).slice(0, 5),
    [players]
  );

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!code || nickname.trim().length === 0) return;
    setJoining(true);
    setJoinError(null);
    const members = isTeam ? teammates.map((t) => t.trim()).filter(Boolean) : null;
    const { data, error } = await supabase.rpc("join_room", {
      p_code: code,
      p_nickname: nickname.trim(),
      p_team_members: members ?? undefined,
    });
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

  async function vote(choice: 0 | 1) {
    if (!room || !creds || choice === myVote) return;
    setDisplayTally((prev) => {
      const next = { ...prev };
      if (myVote === 0) next.a = Math.max(0, next.a - 1);
      if (myVote === 1) next.b = Math.max(0, next.b - 1);
      if (choice === 0) next.a += 1;
      else next.b += 1;
      return next;
    });
    setMyVote(choice);
    await supabase.rpc("cast_vote", {
      p_room_id: room.id,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
      p_choice: choice,
    });
  }

  async function answer(index: number) {
    if (!room || !creds || !question || picked !== null || countdown.expired) return;
    haptics.tap();
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

  function quit() {
    if (code) localStorage.removeItem(playerKey(code));
    router.push("/trivia");
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
          <div className="flex rounded-2xl bg-white/5 border border-white/10 p-1">
            <button
              type="button"
              onClick={() => !soloFull && setIsTeam(false)}
              disabled={soloFull}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold transition disabled:opacity-30 ${!isTeam ? "bg-amber-400 text-black" : "text-slate-300"}`}
            >
              Solo
            </button>
            <button
              type="button"
              onClick={() => {
                if (teamsFull) return;
                setIsTeam(true);
                if (!nickname.startsWith("Team ")) setNickname(`Team ${randomFunName()}`);
              }}
              disabled={teamsFull}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold transition disabled:opacity-30 ${isTeam ? "bg-amber-400 text-black" : "text-slate-300"}`}
            >
              Team
            </button>
          </div>
          {(teamsFull || soloFull) && (
            <p className="text-xs text-amber-400/80 -mt-1">
              {teamsFull && soloFull
                ? "This room is at capacity for our beta (20 teams, 50 solo players). Wait for the next game."
                : teamsFull
                  ? "Teams are full for this beta round (20 max). Join solo instead."
                  : "Solo spots are full for this beta round (50 max). Start or join a team instead."}
            </p>
          )}

          <div className="relative">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={30}
              placeholder="Your name"
              className="w-full text-center text-xl font-bold bg-white/10 border border-white/20 rounded-2xl py-4 pr-14 outline-none focus:border-amber-400"
            />
            <button
              type="button"
              onClick={() => setNickname(isTeam ? `Team ${randomFunName()}` : randomFunName())}
              aria-label="Shuffle name"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold w-14 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 active:scale-90 transition"
            >
              Shuffle
            </button>
          </div>

          {isTeam && (
            <div className="flex flex-col gap-2 bg-white/5 rounded-2xl p-3">
              <p className="text-xs text-slate-400 text-left">Who&#39;s on the team? (optional)</p>
              {teammates.map((t, i) => (
                <input
                  key={i}
                  value={t}
                  onChange={(e) => setTeammates((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                  maxLength={20}
                  placeholder={`Teammate ${i + 1}`}
                  className="text-sm bg-white/10 border border-white/10 rounded-xl py-2 px-3 outline-none focus:border-amber-400"
                />
              ))}
              {teammates.length < 8 && (
                <button
                  type="button"
                  onClick={() => setTeammates((prev) => [...prev, ""])}
                  className="text-xs text-amber-400 self-start"
                >
                  + Add teammate
                </button>
              )}
            </div>
          )}

          {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
          <button
            disabled={joining || nickname.trim().length === 0 || (isTeam ? teamsFull : soloFull)}
            className="rounded-2xl bg-amber-400 text-black font-bold text-lg py-4 disabled:opacity-40 active:scale-95 transition"
          >
            {joining ? "Joining…" : "Join Game"}
          </button>
          <p className="text-xs text-slate-500">Don&#39;t like the name? Tap Shuffle for another, or type your own.</p>
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

        {room.category_option_a && room.category_option_b && (
          <div className="w-full max-w-xs mt-4">
            <p className="text-sm text-slate-400 mb-2">Vote for the topic:</p>
            <div className="grid grid-cols-2 gap-3">
              <VoteButton
                name={packs[room.category_option_a]?.name}
                count={displayTally.a}
                selected={myVote === 0}
                onClick={() => vote(0)}
              />
              <VoteButton
                name={packs[room.category_option_b]?.name}
                count={displayTally.b}
                selected={myVote === 1}
                onClick={() => vote(1)}
              />
            </div>
          </div>
        )}

        <p className="text-amber-400 font-semibold mt-4">
          {players.length} player{players.length === 1 ? "" : "s"} ready
        </p>
        <div className="flex flex-wrap gap-2 justify-center max-w-xs mt-3">
          {recentJoiners.map((p) => (
            <span key={p.id} className="bg-white/10 rounded-full px-3 py-1 text-sm">
              {p.nickname}
            </span>
          ))}
        </div>
        {confirmingQuit && <QuitConfirm onCancel={() => setConfirmingQuit(false)} onConfirm={quit} />}
      </Center>
    );
  }

  if (room.phase === "question" && question) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col px-5 py-6 relative">
        <QuitButton onClick={() => setConfirmingQuit(true)} />
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-amber-400 transition-[width] duration-100 linear" style={{ width: `${countdown.fraction * 100}%` }} />
        </div>
        <p className="text-center text-xs text-slate-500 mb-4">
          Question {room.current_question_index + 1} of {totalQuestions || "?"} · {answeredCount} of {players.length} answered
        </p>
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
        {confirmingQuit && <QuitConfirm onCancel={() => setConfirmingQuit(false)} onConfirm={quit} />}
      </main>
    );
  }

  if (room.phase === "reveal" && question) {
    return (
      <Center>
        <QuitButton onClick={() => setConfirmingQuit(true)} />
        {picked === null ? (
          <p className="text-2xl font-bold">Time&apos;s up. No answer submitted</p>
        ) : result ? (
          <>
            <h1 className={`text-3xl font-black mb-1 ${result.correct ? "text-emerald-400" : "text-rose-400"}`}>
              {result.correct ? "Correct!" : "Not quite"}
            </h1>
            {result.points > 0 && <p className="text-amber-400 text-xl mt-1">+{result.points} points</p>}
          </>
        ) : (
          <p className="text-xl">Checking your answer…</p>
        )}
        {confirmingQuit && <QuitConfirm onCancel={() => setConfirmingQuit(false)} onConfirm={quit} />}
      </Center>
    );
  }

  if (room.phase === "leaderboard" || room.phase === "final") {
    return (
      <Center>
        {room.phase === "leaderboard" && <QuitButton onClick={() => setConfirmingQuit(true)} />}
        <h1 className="text-2xl font-bold mb-1">
          {room.phase === "final" ? "Final Results" : "Leaderboard"}
        </h1>
        <p className="text-slate-400 mb-6">
          You&apos;re #{myRank || "-"} with {me?.score ?? 0} points
        </p>
        <div className="w-full max-w-xs flex flex-col gap-2">
          {sorted.slice(0, 5).map((p, i) => (
            <PlayerRow key={p.id} player={p} rank={i + 1} highlight={p.id === creds.playerId} />
          ))}
        </div>
        {room.phase === "final" && (
          <p className="text-xs text-slate-500 mt-6 max-w-xs">
            Thanks for playing! Ask your host about the next round.
          </p>
        )}
        {confirmingQuit && <QuitConfirm onCancel={() => setConfirmingQuit(false)} onConfirm={quit} />}
      </Center>
    );
  }

  return null;
}

function VoteButton({
  name,
  count,
  selected,
  onClick,
}: {
  name: string | undefined;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition ${
        selected ? "bg-amber-400 text-black border-amber-400" : "bg-white/5 border-white/10"
      }`}
    >
      <div className="font-semibold text-sm">{name ?? "…"}</div>
      <div className={`font-bold text-lg ${selected ? "" : "text-amber-400"}`}>{count} vote{count === 1 ? "" : "s"}</div>
    </button>
  );
}

function PlayerRow({ player, rank, highlight }: { player: Player; rank: number; highlight: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-xl px-4 py-2 ${highlight ? "bg-amber-400 text-black font-bold" : "bg-white/5"}`}>
      <span>
        #{rank} {player.nickname}
        {player.team_members && player.team_members.length > 0 && (
          <span className={`block text-xs font-normal ${highlight ? "text-black/60" : "text-slate-400"}`}>
            {player.team_members.join(", ")}
          </span>
        )}
      </span>
      <span>{player.score}</span>
    </div>
  );
}

function QuitButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute top-4 right-4 text-xs text-slate-500 hover:text-slate-300 underline"
    >
      Quit game
    </button>
  );
}

function QuitConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center px-6 z-50">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-xs w-full text-center">
        <p className="font-bold text-lg mb-1">Quit the game?</p>
        <p className="text-sm text-slate-400 mb-5">You&#39;ll head back to the join/next-game screen.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-xl bg-white/10 py-3 font-semibold">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 rounded-xl bg-red-500 py-3 font-semibold">
            Yes, quit
          </button>
        </div>
      </div>
    </div>
  );
}

function Center({ text, children }: { text?: string; children?: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white flex flex-col items-center justify-center px-6 text-center relative">
      {text ?? children}
    </main>
  );
}
