"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useFeudRoomRealtime } from "@/hooks/useFeudRoomRealtime";
import { useCountdownTo } from "@/hooks/useCountdownTo";
import { feudPlayerKey, type FeudPlayerCredentials, type FeudBoardSlot, type FeudTeam } from "@/lib/types";
import { randomFunName } from "@/lib/funNames";
import { haptics } from "@/lib/haptics";

const JOIN_ERRORS: Record<string, string> = {
  ROOM_NOT_FOUND: "That room code doesn't exist. Double check with your host.",
  ROOM_ALREADY_STARTED: "This game already started — wait for the next one.",
  INVALID_NICKNAME: "Enter a name between 1 and 30 characters.",
  NICKNAME_TAKEN: "Someone in this room already picked that name — try another.",
  ROOM_FULL: "This room is full for our beta round — wait for the next game.",
};

function friendlyError(raw: string, fallback = "Something went wrong. Try again.") {
  const key = Object.keys(JOIN_ERRORS).find((k) => raw.includes(k));
  return key ? JOIN_ERRORS[key] : fallback;
}

export default function FeudPlayPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code?.toUpperCase();
  const { room, players, loading, notFound } = useFeudRoomRealtime(code ?? null);
  const scheduledCountdown = useCountdownTo(room?.phase === "lobby" ? room.starts_at : null);

  const [creds, setCreds] = useState<FeudPlayerCredentials | null>(null);
  const [nickname, setNickname] = useState("");
  const [teamChoice, setTeamChoice] = useState<FeudTeam | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [guess, setGuess] = useState("");
  const [guessing, setGuessing] = useState(false);
  const [guessError, setGuessError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ matched: boolean; points: number } | null>(null);
  const [confirmingQuit, setConfirmingQuit] = useState(false);

  useEffect(() => {
    setNickname(randomFunName());
  }, []);

  useEffect(() => {
    if (!code) return;
    const raw = localStorage.getItem(feudPlayerKey(code));
    if (raw) setCreds(JSON.parse(raw));
  }, [code]);

  // Fresh feedback banner each time the board actually changes (a new guess landed).
  useEffect(() => {
    setLastResult(null);
    setGuessError(null);
  }, [room?.board]);

  const teamAPlayers = useMemo(() => players.filter((p) => p.team === "a"), [players]);
  const teamBPlayers = useMemo(() => players.filter((p) => p.team === "b"), [players]);
  const board = (room?.board as unknown as FeudBoardSlot[] | undefined) ?? [];

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!code || nickname.trim().length === 0) return;
    setJoining(true);
    setJoinError(null);
    const { data, error } = await supabase.rpc("join_feud_room", {
      p_code: code,
      p_nickname: nickname.trim(),
      p_team: teamChoice ?? undefined,
    });
    setJoining(false);
    if (error || !data?.[0]) {
      setJoinError(friendlyError(error?.message ?? ""));
      return;
    }
    const c: FeudPlayerCredentials = {
      playerId: data[0].player_id,
      clientToken: data[0].client_token,
      roomId: data[0].room_id,
      team: data[0].team as FeudTeam,
    };
    localStorage.setItem(feudPlayerKey(code), JSON.stringify(c));
    setCreds(c);
  }

  async function submitGuess(e: React.FormEvent) {
    e.preventDefault();
    if (!room || !creds || guess.trim().length === 0 || guessing) return;
    setGuessing(true);
    setGuessError(null);
    const { data, error } = await supabase.rpc("submit_feud_guess", {
      p_room_id: room.id,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
      p_guess: guess.trim(),
    });
    setGuessing(false);
    setGuess("");
    if (error || !data?.[0]) {
      setGuessError(friendlyError(error?.message ?? "", "Couldn't submit that guess — try again."));
      return;
    }
    haptics.tap();
    if (data[0].o_matched) haptics.correct();
    else haptics.wrong();
    setLastResult({ matched: data[0].o_matched, points: data[0].o_points_awarded });
  }

  function quit() {
    if (code) localStorage.removeItem(feudPlayerKey(code));
    router.push("/feud");
  }

  if (loading) return <Center text="Loading room…" />;
  if (notFound)
    return (
      <Center>
        <p className="text-3xl mb-3">🤔</p>
        <h1 className="text-xl font-bold mb-2">That room doesn&apos;t exist</h1>
        <p className="text-slate-400 max-w-xs">Double-check the code, or ask if there&#39;s a new one.</p>
      </Center>
    );
  if (!room) return null;

  const teamAName = room.team_a_name;
  const teamBName = room.team_b_name;

  if (!creds) {
    return (
      <Center>
        <h1 className="text-2xl font-bold mb-1">Room {room.code}</h1>
        <p className="text-slate-400 mb-6">Family Feud — pick a team</p>
        <form onSubmit={join} className="flex flex-col gap-3 w-full max-w-xs">
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
              onClick={() => setNickname(randomFunName())}
              aria-label="Shuffle name"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-2xl w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 active:scale-90 transition"
            >
              🎲
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <TeamPickButton
              label={teamAName}
              selected={teamChoice === "a"}
              color="bg-rose-600"
              onClick={() => setTeamChoice("a")}
            />
            <TeamPickButton
              label={teamBName}
              selected={teamChoice === "b"}
              color="bg-blue-600"
              onClick={() => setTeamChoice("b")}
            />
            <button
              type="button"
              onClick={() => setTeamChoice(null)}
              className={`text-xs underline ${teamChoice === null ? "text-amber-400" : "text-slate-500"}`}
            >
              No preference — balance me automatically
            </button>
          </div>

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

  const myTeam = creds.team;
  const myTeamName = myTeam === "a" ? teamAName : teamBName;
  const otherTeamName = myTeam === "a" ? teamBName : teamAName;

  if (room.phase === "lobby") {
    const showCountdown = room.starts_at && !scheduledCountdown.reached;
    return (
      <Center>
        <QuitButton onClick={() => setConfirmingQuit(true)} />
        <p className="text-3xl mb-2">🎙️</p>
        <h1 className="text-xl font-bold mb-1">You&apos;re on {myTeamName}!</h1>
        <p className="text-slate-400 mb-4">Waiting for the game to start…</p>
        {showCountdown && <p className="text-4xl font-black text-amber-400 tabular-nums mb-4">{scheduledCountdown.label}</p>}
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
          <RosterCard name={teamAName} color="bg-rose-600" players={teamAPlayers.map((p) => p.nickname)} />
          <RosterCard name={teamBName} color="bg-blue-600" players={teamBPlayers.map((p) => p.nickname)} />
        </div>
        {confirmingQuit && <QuitConfirm onCancel={() => setConfirmingQuit(false)} onConfirm={quit} />}
      </Center>
    );
  }

  if (room.phase === "play" || room.phase === "steal") {
    const isFaceoff = room.phase === "play" && room.controlling_team === null;
    const myTurn =
      isFaceoff ||
      (room.phase === "play" && room.controlling_team === myTeam) ||
      (room.phase === "steal" && room.controlling_team !== myTeam);

    const statusLine = isFaceoff
      ? "🎙️ Face-off! First correct guess wins control."
      : room.phase === "steal"
        ? room.controlling_team === myTeam
          ? `😬 ${otherTeamName} is trying to steal your points!`
          : "🔥 Steal chance — one guess for the win!"
        : room.controlling_team === myTeam
          ? "✅ Your team is in control — keep guessing!"
          : `⏳ ${otherTeamName} is playing…`;

    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col px-5 py-6 relative">
        <QuitButton onClick={() => setConfirmingQuit(true)} />
        <p className="text-center text-xs text-slate-500 mb-1">
          Round {room.current_round_index} of {room.total_rounds} · Pot: {room.pot}
        </p>
        <h2 className="text-lg font-bold mb-3 text-center">{room.current_prompt}</h2>

        <div className="flex flex-col gap-1.5 mb-4">
          {board.map((slot, i) => (
            <div
              key={i}
              className={`rounded-xl px-4 py-2.5 flex items-center justify-between ${
                slot.revealed ? "bg-emerald-700" : "bg-white/5 border border-white/10"
              }`}
            >
              <span className="font-semibold">{slot.revealed ? slot.text : `#${i + 1}`}</span>
              <span className="font-bold text-amber-300">{slot.revealed ? slot.points : "?"}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 mb-3">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-lg ${
                i < room.strikes ? "bg-red-600" : "bg-white/10 text-white/20"
              }`}
            >
              ✕
            </span>
          ))}
        </div>

        <p className="text-center text-sm text-slate-300 mb-3">{statusLine}</p>

        {lastResult && (
          <p className={`text-center font-bold mb-2 ${lastResult.matched ? "text-emerald-400" : "text-red-400"}`}>
            {lastResult.matched ? `✅ On the board! +${lastResult.points}` : "❌ Not on the board"}
          </p>
        )}

        <form onSubmit={submitGuess} className="flex gap-2 mt-auto">
          <input
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            disabled={!myTurn || guessing}
            maxLength={60}
            placeholder={myTurn ? "Type your guess…" : "Not your turn…"}
            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 outline-none focus:border-amber-400 disabled:opacity-40"
          />
          <button
            disabled={!myTurn || guessing || guess.trim().length === 0}
            className="rounded-xl bg-amber-400 text-black font-bold px-5 disabled:opacity-40 active:scale-95 transition"
          >
            Guess
          </button>
        </form>
        {guessError && <p className="text-red-400 text-xs text-center mt-2">{guessError}</p>}
        {room.last_guess && (
          <p className="text-center text-xs text-slate-500 mt-3">
            {(room.last_guess as { nickname: string }).nickname} guessed &ldquo;
            {(room.last_guess as { guess: string }).guess}&rdquo;
          </p>
        )}
        {confirmingQuit && <QuitConfirm onCancel={() => setConfirmingQuit(false)} onConfirm={quit} />}
      </main>
    );
  }

  if (room.phase === "reveal") {
    return (
      <Center>
        <h2 className="text-lg font-bold mb-3">{room.current_prompt}</h2>
        <div className="flex flex-col gap-1.5 w-full max-w-sm mb-4">
          {board.map((slot, i) => (
            <div key={i} className="rounded-xl px-4 py-2.5 flex items-center justify-between bg-emerald-700">
              <span className="font-semibold">{slot.text ?? `#${i + 1}`}</span>
              <span className="font-bold text-amber-300">{slot.points ?? "-"}</span>
            </div>
          ))}
        </div>
        <ScoreRow teamAName={teamAName} teamBName={teamBName} teamAScore={room.team_a_score} teamBScore={room.team_b_score} />
      </Center>
    );
  }

  if (room.phase === "leaderboard" || room.phase === "final") {
    return (
      <Center>
        {room.phase === "leaderboard" && <QuitButton onClick={() => setConfirmingQuit(true)} />}
        <h1 className="text-2xl font-bold mb-1">{room.phase === "final" ? "🎉 Final Results" : "Scoreboard"}</h1>
        <p className="text-slate-400 mb-6">
          {room.phase === "final" ? "Thanks for playing!" : `Round ${room.current_round_index} of ${room.total_rounds}`}
        </p>
        <ScoreRow teamAName={teamAName} teamBName={teamBName} teamAScore={room.team_a_score} teamBScore={room.team_b_score} big />
        {room.phase === "final" && (
          <p className="text-lg font-bold mt-6 text-amber-400">
            {room.team_a_score === room.team_b_score
              ? "It's a tie!"
              : `${room.team_a_score > room.team_b_score ? teamAName : teamBName} wins!`}
          </p>
        )}
        {confirmingQuit && <QuitConfirm onCancel={() => setConfirmingQuit(false)} onConfirm={quit} />}
      </Center>
    );
  }

  return null;
}

function TeamPickButton({
  label,
  selected,
  color,
  onClick,
}: {
  label: string;
  selected: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl py-3 px-4 font-bold text-left transition ${
        selected ? `${color} text-white ring-2 ring-white` : "bg-white/5 border border-white/10 text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

function RosterCard({ name, color, players }: { name: string; color: string; players: string[] }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
      <div className={`${color} text-xs font-bold rounded-full px-2 py-1 inline-block mb-2`}>{name}</div>
      <div className="flex flex-col gap-1 text-sm text-slate-300">
        {players.length === 0 ? <span className="text-slate-500">No one yet</span> : players.map((n) => <span key={n}>{n}</span>)}
      </div>
    </div>
  );
}

function ScoreRow({
  teamAName,
  teamBName,
  teamAScore,
  teamBScore,
  big = false,
}: {
  teamAName: string;
  teamBName: string;
  teamAScore: number;
  teamBScore: number;
  big?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
      <div className="rounded-2xl bg-rose-600/20 border border-rose-600/40 p-4 text-center">
        <div className="text-sm font-semibold text-rose-300">{teamAName}</div>
        <div className={`font-black text-amber-400 ${big ? "text-4xl" : "text-2xl"}`}>{teamAScore}</div>
      </div>
      <div className="rounded-2xl bg-blue-600/20 border border-blue-600/40 p-4 text-center">
        <div className="text-sm font-semibold text-blue-300">{teamBName}</div>
        <div className={`font-black text-amber-400 ${big ? "text-4xl" : "text-2xl"}`}>{teamBScore}</div>
      </div>
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
