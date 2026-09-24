"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
import { useCurrentQuestion } from "@/hooks/useCurrentQuestion";
import { useCountdown } from "@/hooks/useCountdown";
import { useCountdownTo } from "@/hooks/useCountdownTo";
import { useTotalQuestions } from "@/hooks/useTotalQuestions";
import { useAllPacks } from "@/hooks/useAllPacks";
import { useCategoryVoteTally } from "@/hooks/useCategoryVoteTally";
import { useQuestionVotes } from "@/hooks/useQuestionVotes";
import { useTeamProgress } from "@/hooks/useTeamProgress";
import { playerKey, type PlayerCredentials, type FinalRecapRow } from "@/lib/types";
import { randomFunName } from "@/lib/funNames";
import { haptics } from "@/lib/haptics";
import { CategoryIcon } from "@/components/CategoryIcon";

const JOIN_ERRORS: Record<string, string> = {
  ROOM_NOT_FOUND: "That room code doesn't exist. Double check with your host.",
  ROOM_ALREADY_STARTED: "This game already started. Wait for the next one to board.",
  TOO_MANY_JOINS: "Too many joins from this connection. Wait a few seconds and try again.",
  INVALID_NICKNAME: "Enter a name between 1 and 30 characters.",
  NICKNAME_TAKEN: "Someone in this room already picked that name. Try another.",
  INVALID_TEAM_NAME: "Team names need to be between 1 and 30 characters.",
  TEAM_NAME_TAKEN: "Another team already has that name. Try another.",
  TEAM_NOT_FOUND: "That team isn't around anymore. Pick another.",
  TEAM_LOCKED: "That team's round already started. Join a different one.",
  TEAM_FULL: "That team is already full (4 max). Join a different one.",
};

function friendlyError(raw: string) {
  const key = Object.keys(JOIN_ERRORS).find((k) => raw.includes(k));
  return key ? JOIN_ERRORS[key] : "Something went wrong. Try again.";
}

export default function PlayPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code?.toUpperCase();
  const { room, players, teams, loading, notFound } = useRoomRealtime(code ?? null);
  const question = useCurrentQuestion(room?.id, room?.current_question_index, room?.phase);
  const countdown = useCountdown(room?.question_started_at ?? null, question?.time_limit_seconds ?? 15);
  const scheduledCountdown = useCountdownTo(room?.starts_at ?? null);
  const totalQuestions = useTotalQuestions(room?.id, room?.phase);
  const packs = useAllPacks();
  const voteTally = useCategoryVoteTally(room?.phase === "lobby" ? room?.id : undefined);
  // Realtime confirmation typically lands well under a second, but the tap
  // should feel instant regardless — bump the shown count immediately and
  // let the next real tally (which will already agree) replace it.
  const [displayTally, setDisplayTally] = useState<Record<string, number>>(voteTally);
  useEffect(() => setDisplayTally(voteTally), [voteTally]);

  const [creds, setCreds] = useState<PlayerCredentials | null>(null);
  const [nickname, setNickname] = useState("");
  const [withTeam, setWithTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [sendingVote, setSendingVote] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [confirmingHint, setConfirmingHint] = useState(false);
  const [gettingHint, setGettingHint] = useState(false);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [confirmingQuit, setConfirmingQuit] = useState(false);
  const [recap, setRecap] = useState<FinalRecapRow[] | null>(null);
  const teamProgress = useTeamProgress(room?.phase === "question" ? room?.id : undefined, room?.phase === "question" ? question?.id : undefined);
  const { votes: questionVotes, lock: teamLock, hint: teamHint, refresh: refreshVotes } = useQuestionVotes(
    room?.id,
    room?.phase === "question" ? question?.id : undefined,
    creds
  );

  useEffect(() => {
    setNickname(randomFunName());
  }, []);

  useEffect(() => {
    if (!code) return;
    const raw = localStorage.getItem(playerKey(code));
    if (raw) setCreds(JSON.parse(raw));
  }, [code]);

  // Reset per-question vote state whenever the room moves to a new question.
  useEffect(() => {
    setAnswerText("");
    setVoteError(null);
    setConfirmingHint(false);
  }, [room?.current_question_index]);

  // Reset category vote choice whenever a fresh room (new code) shows up.
  useEffect(() => {
    setMyVote(null);
  }, [room?.id]);

  useEffect(() => {
    if (room?.phase !== "final" || !room.id || recap) return;
    supabase.rpc("get_final_recap", { p_room_id: room.id }).then(({ data }) => {
      if (data) setRecap(data as FinalRecapRow[]);
    });
  }, [room?.phase, room?.id, recap]);

  const activePlayers = useMemo(() => players.filter((p) => !p.left_at), [players]);
  const recentJoiners = useMemo(
    () =>
      [...activePlayers].sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime()).slice(0, 5),
    [activePlayers]
  );
  const joinableTeams = useMemo(
    () =>
      teams
        .filter((t) => t.kind === "self" && !t.locked)
        .map((t) => ({ ...t, memberCount: activePlayers.filter((p) => p.team_id === t.id).length }))
        .filter((t) => t.memberCount < 4),
    [teams, activePlayers]
  );

  const me = useMemo(() => players.find((p) => p.id === creds?.playerId), [players, creds]);
  const myTeam = useMemo(() => teams.find((t) => t.id === creds?.teamId), [teams, creds]);
  const teammates = useMemo(
    () => activePlayers.filter((p) => p.team_id === creds?.teamId),
    [activePlayers, creds]
  );
  const sortedTeams = useMemo(() => [...teams].sort((a, b) => b.score - a.score), [teams]);
  const myTeamRank = creds ? sortedTeams.findIndex((t) => t.id === creds.teamId) + 1 : 0;

  // Kahoot-style podium reveal: 3rd, then 2nd, then a suspense beat, then
  // 1st -- only after all of that plays out do the rest of the standings,
  // the recap, and the way back to the menu show up.
  const topThree = useMemo(() => sortedTeams.slice(0, Math.min(3, sortedTeams.length)), [sortedTeams]);
  const restTeams = useMemo(() => sortedTeams.slice(topThree.length), [sortedTeams, topThree]);
  const revealOrder = useMemo(() => [...topThree].reverse(), [topThree]);
  const [revealCount, setRevealCount] = useState(0);
  const [suspense, setSuspense] = useState(false);
  const [showRest, setShowRest] = useState(false);

  useEffect(() => {
    if (room?.phase !== "final" || revealOrder.length === 0) return;
    let cancelled = false;
    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    async function run() {
      await sleep(1000);
      for (let i = 0; i < revealOrder.length; i++) {
        if (cancelled) return;
        const isWinner = i === revealOrder.length - 1;
        if (isWinner && revealOrder.length > 1) {
          setSuspense(true);
          await sleep(2500);
          if (cancelled) return;
          setSuspense(false);
        }
        setRevealCount(i + 1);
        await sleep(isWinner ? 900 : 1600);
      }
      if (!cancelled) setShowRest(true);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [room?.phase, room?.id, revealOrder.length]);

  const revealedPodium = useMemo(
    () =>
      revealOrder
        .map((t, idx) => ({ team: t, rank: topThree.length - idx }))
        .slice(0, revealCount)
        .reverse(),
    [revealOrder, topThree.length, revealCount]
  );

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!code || nickname.trim().length === 0) return;
    setJoining(true);
    setJoinError(null);
    const { data, error } = await supabase.rpc("join_room", {
      p_code: code,
      p_nickname: nickname.trim(),
      p_team_id: newTeamName.trim().length === 0 ? selectedTeamId ?? undefined : undefined,
      p_new_team_name: newTeamName.trim().length > 0 ? newTeamName.trim() : undefined,
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
      teamId: data[0].team_id,
      teamName: data[0].team_name,
    };
    localStorage.setItem(playerKey(code), JSON.stringify(c));
    setCreds(c);
  }

  async function vote(packId: string) {
    if (!room || !creds || packId === myVote) return;
    setDisplayTally((prev) => {
      const next = { ...prev };
      if (myVote) next[myVote] = Math.max(0, (next[myVote] ?? 0) - 1);
      next[packId] = (next[packId] ?? 0) + 1;
      return next;
    });
    setMyVote(packId);
    await supabase.rpc("cast_vote", {
      p_room_id: room.id,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
      p_pack_id: packId,
    });
  }

  // A vote can be changed any time before the timer runs out; the team's
  // answer is whatever most of the team is voting for when it does.
  async function castVote(text: string) {
    const t = text.trim();
    if (!room || !creds || !question || countdown.expired || sendingVote || t.length === 0) return;
    haptics.tap();
    setSendingVote(true);
    setVoteError(null);
    const { error } = await supabase.rpc("cast_team_vote", {
      p_room_id: room.id,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
      p_question_id: question.id,
      p_answer_text: t,
    });
    setSendingVote(false);
    if (error) {
      if (/TEAM_LOCKED_IN/.test(error.message)) {
        refreshVotes();
        return;
      }
      setVoteError(
        /TIME_EXPIRED|NOT_ACCEPTING_ANSWERS|STALE_QUESTION/.test(error.message)
          ? "Time ran out before that vote landed, so it didn't count."
          : "Your vote didn't go through. Try again."
      );
      return;
    }
    setAnswerText(t);
    refreshVotes();
  }

  // A hint narrows the answer to two options for the whole team, and halves
  // what a correct answer is worth on this question -- so it's confirmed first.
  async function requestHint() {
    if (!room || !creds || !question || gettingHint) return;
    setGettingHint(true);
    const { error } = await supabase.rpc("use_team_hint", {
      p_room_id: room.id,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
      p_question_id: question.id,
    });
    setGettingHint(false);
    setConfirmingHint(false);
    if (error && !/TEAM_LOCKED_IN/.test(error.message)) {
      setVoteError(/TIME_EXPIRED|NOT_ACCEPTING_ANSWERS|STALE_QUESTION/.test(error.message)
        ? "Time ran out before the hint came through."
        : "Couldn't get a hint just now. Try again.");
    }
    refreshVotes();
  }

  function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    castVote(answerText);
  }

  // Leaving is a soft flag server-side (players.left_at), not a delete, so a
  // score already earned still shows up on the leaderboard -- it just marks
  // this player as no longer active, which realtime pushes to everyone else
  // already subscribed to this room (other players, host, the venue screen)
  // for free, and frees their spot on the team.
  async function leaveRoom(destination: string) {
    if (creds && code) {
      await supabase.rpc("leave_room", {
        p_room_id: creds.roomId,
        p_player_id: creds.playerId,
        p_client_token: creds.clientToken,
      });
      localStorage.removeItem(playerKey(code));
    }
    router.push(destination);
  }

  if (loading) return <Center text="Loading room…" />;
  if (notFound)
    return (
      <Center>
        <BackButton onClick={() => router.push("/")} />
        <h1 className="text-xl font-bold mb-2">That room doesn&apos;t exist</h1>
        <p className="text-slate-400 max-w-xs">Double check the code with your host, or ask if there&#39;s a new one.</p>
      </Center>
    );
  if (!room) return null;

  if (!creds) {
    return (
      <Center>
        <BackButton onClick={() => leaveRoom("/")} />
        <h1 className="text-2xl font-bold mb-1">Room {room.code}</h1>
        <p className="text-slate-400 mb-6">Ready to play?</p>
        {activePlayers.length > 0 && (
          <div className="w-full max-w-xs mb-6 rounded-2xl bg-white/5 border border-white/10 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">
              {activePlayers.length} already here
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {recentJoiners.map((p) => (
                <span key={p.id} className="bg-white/10 rounded-full px-3 py-1 text-sm">
                  {p.nickname}
                </span>
              ))}
            </div>
          </div>
        )}
        <form onSubmit={join} className="flex flex-col gap-3 w-full max-w-xs">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
            {withTeam ? "Playing with a Team" : "Playing Solo"}
          </p>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={30}
            placeholder="Your name"
            className="w-full text-center text-xl font-bold bg-white/10 border border-white/20 rounded-2xl py-4 outline-none focus:border-amber-400"
          />

          {!withTeam && (
            <>
              <p className="text-xs text-slate-500">
                You&apos;ll be grouped into an open team (up to 4 people) automatically.
              </p>
              <button
                type="button"
                onClick={() => setWithTeam(true)}
                className="mt-2 rounded-2xl border-2 border-amber-400 bg-amber-400/10 text-amber-300 font-bold text-lg py-5 active:scale-95 transition"
              >
                Playing with a Team?
              </button>
            </>
          )}

          {withTeam && (
            <div className="flex flex-col gap-3">
              {joinableTeams.length > 0 && !newTeamName && (
                <div className="flex flex-col gap-2 bg-white/5 rounded-2xl p-3">
                  <p className="text-xs text-slate-400 text-left">Join a team someone already started:</p>
                  <div className="flex flex-wrap gap-2">
                    {joinableTeams.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTeamId(selectedTeamId === t.id ? null : t.id)}
                        className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                          selectedTeamId === t.id ? "bg-amber-400 text-black" : "bg-white/10 text-slate-200"
                        }`}
                      >
                        {t.name} ({t.memberCount}/4)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!newTeamName && (
                <button
                  type="button"
                  onClick={() => {
                    setNewTeamName(`Team ${randomFunName()}`);
                    setSelectedTeamId(null);
                  }}
                  className="text-xs text-amber-400 self-center"
                >
                  Or start your own team
                </button>
              )}

              {newTeamName && (
                <div className="flex flex-col gap-2 bg-white/5 rounded-2xl p-3">
                  <p className="text-xs text-slate-400 text-left">
                    Your team&apos;s name (needs 3 people total by round start, or you&apos;ll be folded into an open
                    team)
                  </p>
                  <div className="relative">
                    <input
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      maxLength={30}
                      placeholder="Team name"
                      className="w-full text-center font-bold bg-white/10 border border-white/10 rounded-xl py-3 pr-16 pl-3 outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setNewTeamName(`Team ${randomFunName()}`)}
                      aria-label="Shuffle team name"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-bold px-2.5 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 active:scale-90 transition"
                    >
                      Shuffle
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 text-left">
                    Tap Shuffle for another name, or type your own to display it however you like.
                  </p>
                  <button type="button" onClick={() => setNewTeamName("")} className="text-xs text-slate-400 self-start">
                    Never mind, join a team instead
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setWithTeam(false);
                  setNewTeamName("");
                  setSelectedTeamId(null);
                }}
                className="text-xs text-slate-400 self-center"
              >
                Never mind, play solo
              </button>
            </div>
          )}

          {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
          <button
            disabled={joining || nickname.trim().length === 0}
            className="rounded-2xl bg-amber-400 text-black font-bold text-lg py-4 disabled:opacity-40 active:scale-95 transition"
          >
            {joining ? "Joining…" : newTeamName ? "Create & Join" : selectedTeamId ? "Join Team" : "Join Game"}
          </button>
        </form>
      </Center>
    );
  }

  if (room.phase === "lobby") {
    const showCountdown = room.starts_at && !scheduledCountdown.reached;
    return (
      <Center>
        <BackButton onClick={() => leaveRoom("/")} />
        <h1 className="text-2xl font-bold mb-1">You&apos;re on {myTeam?.name ?? creds.teamName}!</h1>
        <p className="text-slate-400 mb-4">{me?.nickname}</p>

        {room.category_options && room.category_options.length > 0 ? (
          <div className="w-full max-w-xs rounded-2xl bg-amber-400/10 border border-amber-400/30 p-4">
            <p className="text-base font-bold text-white mb-1">Vote for tonight&apos;s category</p>
            {showCountdown ? (
              <p className="text-xs text-slate-300 mb-3">
                Voting closes in{" "}
                <span className="text-amber-400 font-bold tabular-nums">{scheduledCountdown.label}</span>
              </p>
            ) : (
              <p className="text-xs text-slate-400 mb-3">
                This game runs itself. It starts automatically, whether people are here yet or not.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {room.category_options.map((packId) => (
                <VoteButton
                  key={packId}
                  name={packs[packId]?.name}
                  icon={packs[packId]?.icon}
                  count={displayTally[packId] ?? 0}
                  selected={myVote === packId}
                  onClick={() => vote(packId)}
                />
              ))}
            </div>
          </div>
        ) : showCountdown ? (
          <p className="text-slate-300 mb-1">
            Starting in <span className="text-amber-400 font-bold tabular-nums">{scheduledCountdown.label}</span>
          </p>
        ) : (
          <p className="text-slate-400 mb-1">
            This game runs itself. It starts automatically, whether people are here yet or not.
          </p>
        )}

        <div className="w-full max-w-xs mt-4 rounded-2xl bg-amber-400/10 border border-amber-400/30 p-4">
          <p className="text-xs uppercase tracking-widest text-amber-400 mb-2">Your team</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {teammates.map((p) => (
              <span key={p.id} className="bg-white/10 rounded-full px-3 py-1 text-sm">
                {p.nickname}
              </span>
            ))}
          </div>
          {myTeam?.kind === "self" && teammates.length < 3 && (
            <p className="text-xs text-amber-400/80 mt-2">
              Needs {3 - teammates.length} more to stay its own team, or you&apos;ll join an open team when the round starts.
            </p>
          )}
        </div>

        <p className="text-amber-400 font-semibold mt-4">
          {activePlayers.length} player{activePlayers.length === 1 ? "" : "s"} ready across {teams.length} team
          {teams.length === 1 ? "" : "s"}
        </p>
        <div className="w-full max-w-xs mt-3 flex flex-col gap-2 text-left">
          {teams.map((t) => {
            const members = activePlayers.filter((p) => p.team_id === t.id);
            return (
              <div
                key={t.id}
                className={`rounded-xl px-3 py-2 ${t.id === creds.teamId ? "bg-amber-400/20" : "bg-white/5"}`}
              >
                <p className="text-sm font-bold">
                  {t.name} <span className="font-normal text-slate-400">({members.length}/4)</span>
                </p>
                <p className="text-xs text-slate-300">{members.map((p) => p.nickname).join(", ")}</p>
              </div>
            );
          })}
        </div>
      </Center>
    );
  }

  if (room.phase === "question" && question) {
    const myVote = questionVotes[creds.playerId];
    const teamOptions = groupTeamVotes(teammates, questionVotes, creds.playerId);
    const waitingOn = teammates.filter((p) => questionVotes[p.id] === undefined).map((p) => (p.id === creds.playerId ? "You" : p.nickname));
    const locked = teamLock !== null;
    const canVote =
      !locked &&
      !countdown.expired &&
      !sendingVote &&
      answerText.trim().length > 0 &&
      !(myVote !== undefined && normalizeAnswer(myVote) === normalizeAnswer(answerText));
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col px-5 py-6 relative">
        <div className="flex items-center justify-between mb-2">
          <ExitButton onClick={() => setConfirmingQuit(true)} />
          <TeamBadge name={myTeam?.name ?? creds.teamName} />
        </div>
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-amber-400 transition-[width] duration-100 linear" style={{ width: `${countdown.fraction * 100}%` }} />
        </div>
        <p className="text-center text-xs text-slate-500 mb-4">
          Question {room.current_question_index + 1} of {totalQuestions || "?"}
        </p>
        <h2 className="text-xl font-bold mb-6 text-center">{question.prompt}</h2>
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-3">
            <CategoryBadge
              name={room.winning_category_id ? packs[room.winning_category_id]?.name : undefined}
              icon={room.winning_category_id ? packs[room.winning_category_id]?.icon : undefined}
            />
            <CountdownRing fraction={countdown.fraction} seconds={countdown.remainingSeconds} />
          </div>
          {locked ? (
            <div className="w-full max-w-sm rounded-2xl bg-emerald-500/15 border border-emerald-400/50 px-5 py-4 text-center">
              <p className="text-xs uppercase tracking-widest text-emerald-300 mb-1">Locked in</p>
              <p className="text-2xl font-black break-words">{teamLock}</p>
              <p className="text-sm text-slate-300 mt-1">Everyone agreed, so that&apos;s your team&apos;s answer.</p>
            </div>
          ) : (
          <form onSubmit={submitAnswer} className="w-full max-w-sm flex flex-col gap-3">
            <input
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              disabled={countdown.expired}
              maxLength={200}
              placeholder="Type your answer…"
              autoComplete="off"
              className="w-full text-center text-lg font-semibold bg-white/10 border border-white/20 rounded-2xl py-4 px-4 outline-none focus:border-amber-400 disabled:opacity-50"
            />
            <button
              disabled={!canVote}
              className="rounded-2xl bg-amber-400 text-black font-bold text-lg py-4 disabled:opacity-40 active:scale-95 transition"
            >
              {sendingVote ? "Sending…" : !myVote ? "Submit Vote" : canVote ? "Change my vote" : "Vote in"}
            </button>
            {voteError && <p className="text-center text-sm text-rose-400">{voteError}</p>}
          </form>
          )}
          {teamHint ? (
            <div className="w-full max-w-sm rounded-2xl bg-sky-500/10 border border-sky-400/40 px-4 py-3 text-center">
              <p className="text-xs uppercase tracking-widest text-sky-300 mb-1">Hint · worth 500 points now</p>
              <p className="font-semibold">{teamHint}</p>
            </div>
          ) : !locked && !countdown.expired ? (
            confirmingHint ? (
              <div className="w-full max-w-sm rounded-2xl bg-white/5 border border-amber-400/40 px-4 py-3 text-center">
                <p className="font-semibold mb-1">Use a hint?</p>
                <p className="text-sm text-slate-300 mb-3">
                  It narrows the answer down to two. If your team gets it right, you&apos;ll earn 500 points instead of 1,000 on this question. Your whole team will see it.
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setConfirmingHint(false)} className="flex-1 rounded-xl bg-white/10 py-2 font-semibold">
                    Never mind
                  </button>
                  <button
                    type="button"
                    onClick={requestHint}
                    disabled={gettingHint}
                    className="flex-1 rounded-xl bg-amber-400 text-black py-2 font-bold disabled:opacity-50"
                  >
                    {gettingHint ? "Getting hint…" : "Show hint (−500)"}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmingHint(true)} className="text-sm text-sky-300 underline underline-offset-4">
                Stuck? Get a hint (costs half the points)
              </button>
            )
          ) : null}
        </div>
        <div className="mt-4 w-full max-w-sm mx-auto">
          <p className="text-xs uppercase tracking-widest text-amber-400 mb-2 text-center">Your team&apos;s votes</p>
          {teamOptions.length > 0 ? (
            <div className="flex flex-col gap-2">
              {teamOptions.map((o, i) => (
                <button
                  key={o.text}
                  type="button"
                  onClick={() => !o.mine && castVote(o.text)}
                  disabled={o.mine || locked || countdown.expired || sendingVote}
                  className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition active:scale-[0.98] ${
                    o.mine ? "bg-amber-400/20 border border-amber-400/50" : "bg-white/5 border border-white/10 hover:border-white/30"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold truncate">
                      {o.text}
                      {i === 0 && teamOptions.length > 1 && o.voters.length > teamOptions[1].voters.length && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-300">Leading</span>
                      )}
                    </span>
                    <span className="block text-xs text-slate-400 truncate">Voted by {o.voters.join(", ")}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-300">
                    {o.mine ? "Your vote" : locked || countdown.expired ? `${o.voters.length} vote${o.voters.length === 1 ? "" : "s"}` : "Go with this"}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-slate-500">No votes yet. Be the first.</p>
          )}
          {waitingOn.length > 0 && !countdown.expired && !locked && (
            <p className="text-center text-xs text-slate-500 mt-2">Still thinking: {waitingOn.join(", ")}</p>
          )}
          <p className="text-center text-xs text-slate-500 mt-3">
            {locked
              ? "Your team is done with this one. Results are revealed at the end of the game."
              : countdown.expired
                ? "Time's up. Your team's answer is whatever got the most votes. Results are revealed at the end of the game."
                : teammates.length > 1
                  ? "Tap a teammate's answer to go with it, or type your own. When everyone agrees, it locks in. Otherwise the most votes wins when time runs out."
                  : "Type your answer. You can change it until time runs out."}
          </p>
          {teamProgress.some((t) => t.id !== creds.teamId) && (
            <div className="mt-4 border-t border-white/10 pt-3">
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-2 text-center">Other teams</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {teamProgress
                  .filter((t) => t.id !== creds.teamId)
                  .map((t) => (
                    <span
                      key={t.id}
                      className={`rounded-full px-3 py-1 text-xs ${
                        t.locked ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-slate-400"
                      }`}
                    >
                      {t.name} · {t.locked ? "locked in" : `${t.voted}/${t.members} voted`}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
        {confirmingQuit && <QuitConfirm onCancel={() => setConfirmingQuit(false)} onConfirm={() => leaveRoom("/trivia")} />}
      </main>
    );
  }

  if (room.phase === "final") {
    const myRecap = recap?.filter((r) => r.o_team_id === creds.teamId) ?? [];
    return (
      <Center>
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
          <ExitButton onClick={() => leaveRoom("/trivia")} />
          <TeamBadge name={myTeam?.name ?? creds.teamName} />
        </div>
        <h1 className="text-2xl font-bold mb-6">Final Results</h1>

        <div className="w-full max-w-xs flex flex-col gap-2 mb-2">
          {revealedPodium.map(({ team, rank }) => (
            <PodiumRow key={team.id} rank={rank} name={team.name} score={team.score} mine={team.id === creds.teamId} />
          ))}
        </div>

        {suspense && (
          <div className="flex flex-col items-center gap-3 py-6 animate-pop-in">
            <p className="text-sm uppercase tracking-widest text-slate-400">And in 1st place…</p>
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-suspense-pulse" style={{ animationDelay: "0ms" }} />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-suspense-pulse" style={{ animationDelay: "150ms" }} />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-suspense-pulse" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        {showRest && (
          <div className="w-full max-w-xs flex flex-col gap-4 animate-pop-in">
            <p className="text-slate-400">
              {myTeam?.name ?? creds.teamName} finished #{myTeamRank || "-"} with {myTeam?.score ?? 0} points
            </p>

            {restTeams.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Also competing</p>
                {restTeams.map((t, i) => (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between rounded-xl px-4 py-2 text-sm ${
                      t.id === creds.teamId ? "bg-amber-400/20 text-amber-300 font-bold" : "bg-white/5 text-slate-300"
                    }`}
                  >
                    <span>
                      #{topThree.length + i + 1} {t.name}
                    </span>
                    <span>{t.score}</span>
                  </div>
                ))}
              </div>
            )}

            {myRecap.length > 0 && (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Question recap</p>
                {myRecap.map((r) => (
                  <div key={r.o_question_order} className="rounded-xl bg-white/5 px-4 py-3 text-left">
                    <p className="text-sm font-semibold mb-1">{r.o_prompt}</p>
                    <p className="text-xs text-slate-400">
                      Correct: <span className="text-emerald-400">{r.o_correct_answer}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Your team said:{" "}
                      <span className={r.o_team_correct ? "text-emerald-400" : "text-rose-400"}>
                        {r.o_team_answer ?? "No vote cast"}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => leaveRoom("/")}
              className="rounded-2xl bg-amber-400 text-black font-bold text-lg py-4 active:scale-95 transition"
            >
              Back to Games
            </button>
          </div>
        )}
      </Center>
    );
  }

  return null;
}

function VoteButton({
  name,
  icon,
  count,
  selected,
  onClick,
}: {
  name: string | undefined;
  icon: string | null | undefined;
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
      <CategoryIcon slug={icon} className={`w-5 h-5 mb-1 ${selected ? "text-black" : "text-amber-400"}`} />
      <div className="font-semibold text-sm">{name ?? "…"}</div>
      <div className={`font-bold text-lg ${selected ? "" : "text-amber-400"}`}>{count} vote{count === 1 ? "" : "s"}</div>
    </button>
  );
}

// Before the round starts there's nothing at stake, so Back just leaves
// immediately -- no confirmation. It's deliberately a solid, high-contrast
// pill (not a subtle text link) so it's never in doubt where the exit is.
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute top-4 left-4 z-10 rounded-full bg-white/15 border border-white/30 px-4 py-2 text-sm font-bold text-white hover:bg-white/25 active:scale-95 transition"
    >
      Back
    </button>
  );
}

// Once the round is live, leaving means abandoning your team mid-vote, so
// this is styled to stand out (and gated by a confirmation) -- same "big,
// obvious pill" idea as BackButton, just relabeled and colored as a warning.
function ExitButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full bg-red-500/20 border border-red-500/50 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-500/30 active:scale-95 transition"
    >
      Exit
    </button>
  );
}

function CategoryBadge({ name, icon }: { name?: string; icon?: string | null }) {
  if (!name) return null;
  return (
    <span className="flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-300">
      <CategoryIcon slug={icon} className="w-4 h-4 text-amber-400" />
      {name}
    </span>
  );
}

// Fills the gap between the prompt and the answer box with something that
// actually communicates urgency, rather than leaving it visually dead —
// the same fraction/seconds already driving the top progress bar, just
// rendered as a ring since that's the natural shape for "time remaining."
function CountdownRing({ fraction, seconds }: { fraction: number; seconds: number }) {
  const size = 96;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - fraction);
  const urgent = fraction <= 0.2;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={urgent ? "#f87171" : "#fbbf24"}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-100 linear"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-2xl font-black tabular-nums ${urgent ? "text-red-400" : "text-amber-400"}`}>
          {seconds}
        </span>
      </div>
    </div>
  );
}

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function PodiumRow({ rank, name, score, mine }: { rank: number; name: string; score: number; mine: boolean }) {
  const isWinner = rank === 1;
  return (
    <div
      className={`animate-pop-in flex items-center justify-between rounded-2xl px-4 transition ${
        isWinner
          ? "py-5 bg-amber-400 text-black shadow-lg shadow-amber-400/30 border-2 border-amber-300"
          : mine
            ? "py-3 bg-amber-400/20 text-amber-300 border border-amber-400/40"
            : "py-3 bg-white/5 text-white border border-white/10"
      }`}
    >
      <span className={`font-bold ${isWinner ? "text-xl" : "text-base"}`}>
        {RANK_MEDAL[rank] ?? `#${rank}`} {name}
      </span>
      <span className={isWinner ? "text-xl font-black" : "font-semibold"}>{score}</span>
    </div>
  );
}

function TeamBadge({ name }: { name: string }) {
  return (
    <span className="rounded-full bg-amber-400/15 border border-amber-400/40 px-4 py-2 text-sm font-bold text-amber-300">
      {name}
    </span>
  );
}

function QuitConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center px-6 z-50">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-xs w-full text-center">
        <p className="font-bold text-lg mb-1">Exit the game?</p>
        <p className="text-sm text-slate-400 mb-5">Your team will be notified, and your spot opens up for someone else.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-xl bg-white/10 py-3 font-semibold">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 rounded-xl bg-red-500 py-3 font-semibold">
            Yes, exit
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

function normalizeAnswer(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

type TeamVoteOption = { text: string; voters: string[]; mine: boolean };

// Groups the team's votes by answer (ignoring case and punctuation) so
// everyone can see what's leading. The server groups more loosely -- by
// meaning, so "mint" and "mint leaves" count together -- this is just the
// at-a-glance view.
function groupTeamVotes(
  teammates: { id: string; nickname: string }[],
  votes: Record<string, string>,
  myId: string
): TeamVoteOption[] {
  const groups = new Map<string, TeamVoteOption>();
  for (const p of teammates) {
    const v = votes[p.id];
    if (!v) continue;
    const key = normalizeAnswer(v);
    const g = groups.get(key) ?? { text: v, voters: [], mine: false };
    g.voters.push(p.id === myId ? "You" : p.nickname);
    if (p.id === myId) g.mine = true;
    groups.set(key, g);
  }
  return Array.from(groups.values()).sort((a, b) => b.voters.length - a.voters.length);
}
