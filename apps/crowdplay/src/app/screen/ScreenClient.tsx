"use client";

import { isOpenFor, secondsFor, shuffledChoices } from "@/lib/questionMode";
import { isTwist, twistBanner, twistDescription, type TwistContext } from "@/lib/twists";
import { TwistBanner, TwistIntro } from "@/components/TwistIntro";
import { useFogs } from "@/hooks/useFogs";
import { useRoomPowers } from "@/hooks/usePowers";
import { PowerFeed } from "@/components/PowerFeed";
import { RoundStandings } from "@/components/RoundStandings";
import { FunFact } from "@/components/RoundExtras";
import { useEffect, useMemo, useRef, useState } from "react";
import { listenForUnlock, setVolume, sounds } from "@/lib/sounds";
import { useActiveRoom } from "@/hooks/useActiveRoom";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
import { useCurrentQuestion } from "@/hooks/useCurrentQuestion";
import { useCountdown } from "@/hooks/useCountdown";
import { useCountdownTo } from "@/hooks/useCountdownTo";
import { useTotalQuestions } from "@/hooks/useTotalQuestions";
import { useAllPacks } from "@/hooks/useAllPacks";
import { JoinQRCode } from "@/components/JoinQRCode";
import { useTriviaQueue, roundsToWaitLabel } from "@/hooks/useTriviaQueue";
import { ScreenAgent } from "@/components/ScreenAgent";
import { useScreenVenue, useVenueId } from "@/lib/venue";
import { supabase } from "@/lib/supabase";
import type { Team, FinalRecapRow, SuddenDeathResult } from "@/lib/types";
import { GetReady } from "@/components/GetReady";
import { SuddenDeathResultList } from "@/components/SuddenDeath";
import { useQuestionById } from "@/hooks/useQuestionById";
import { useAvatars } from "@/hooks/useAvatars";
import { Avatar } from "@/components/Avatar";
import { useAnsweredPlayers } from "@/hooks/useAnsweredPlayers";
import { useQuestionReveal } from "@/hooks/useQuestionReveal";
import { LockInStrip, PickYourCorner } from "@/components/RoomCharacters";
import { JoinDrops } from "@/components/JoinDrops";
import Link from "next/link";
import { ScanCards } from "@/components/ScanCards";
import { ReadyLineup } from "@/components/ReadyLineup";
import { Podium } from "@/components/Podium";

/**
 * The venue's TV/projector view — leave this open all night. It always
 * follows whatever game is currently active (no room code needed) and is
 * pure spectator: no buttons, nothing to click. The database's autonomous
 * ticker drives every phase change on its own, so this page just reflects
 * whatever's true right now, the same as any player's phone would. Scoring
 * is team-based; the standings stay hidden until the game ends, but after
 * each question a short reveal shows who picked what.
 */
export default function ScreenClient() {
  const venue = useScreenVenue();
  const venueId = useVenueId(venue);
  const activeRoom = useActiveRoom(venueId);
  const code = activeRoom?.code ?? null;
  const { room, players, teams } = useRoomRealtime(code);
  const question = useCurrentQuestion(room?.id, room?.current_question_index, room?.phase);
  const countdown = useCountdown(room?.question_started_at ?? null, secondsFor(question));
  // Game twists: names for the intro and banner; a live feed of fogs on sabotage.
  const twist = isTwist(question?.twist) ? question.twist : null;
  const twistCtx: TwistContext = {
    // A team of one is a solo player: name the player.
    teamName: (id) => {
      const on = players.filter((p) => p.team_id === id && !p.left_at);
      return on.length === 1 ? on[0].nickname : teams.find((t) => t.id === id)?.name ?? "A team";
    },
    playerName: (id) => players.find((p) => p.id === id)?.nickname ?? "a player",
    twistTeams: question?.twist_teams,
    captains: question?.captains,
  };
  const fogs = useFogs(
    room?.phase === "question" && twist === "sabotage" ? room.id : undefined,
    twist === "sabotage" ? question?.id : undefined
  );
  // Character powers used on this question: a feed beside the question, then
  // tags on the scores at the reveal.
  const roomPowers = useRoomPowers(
    room?.phase === "question" || room?.phase === "reveal" ? room.id : undefined,
    question?.id
  );
  const powerWho = {
    playerName: (id: string) => players.find((p) => p.id === id)?.nickname ?? "A player",
    teamName: (id: string) => teams.find((t) => t.id === id)?.name ?? "a team",
    face: (id: string) => {
      const a = avatarsById[players.find((p) => p.id === id)?.avatar_id ?? ""];
      return a ? { emoji: a.emoji, imageUrl: a.imageUrl } : undefined;
    },
  };
  const scheduledCountdown = useCountdownTo(room?.starts_at ?? null);
  const totalQuestions = useTotalQuestions(room?.id, room?.phase);
  const answeredIds = useAnsweredPlayers(room?.phase === "question" ? question?.id : undefined);
  const reveal = useQuestionReveal(room?.id, room?.phase, room?.current_question_index);
  const packs = useAllPacks();
  const [recap, setRecap] = useState<FinalRecapRow[] | null>(null);
  const questionStart = useCountdownTo(room?.phase === "question" ? room.question_started_at : null);
  // Reveal: who picked what for 6 seconds, then the top 3 (12-second reveal).
  const revealClock = useCountdownTo(
    room?.phase === "reveal" && room.phase_started_at ? new Date(Date.parse(room.phase_started_at) + 6000).toISOString() : null
  );
  const sdStart = useCountdownTo(room?.phase === "sudden_death" ? room.sd_started_at : null);
  const sdClock = useCountdown(room?.phase === "sudden_death" ? room.sd_started_at : null, 20);
  const sdPrompt = useQuestionById(room?.phase === "sudden_death" ? room.sd_question_id : null);
  const { byId: avatarsById } = useAvatars();
  // Busy nights: while this game runs (or its lobby is full), the next
  // game is already open for sign-ups. Show its code in the corner.
  const queue = useTriviaQueue(venueId);
  const nextGame = queue.find((q) => !q.o_full);

  // "Active" excludes anyone who's left -- the standings keep every team
  // (including ones whose members left), since a score already earned
  // shouldn't just vanish.
  const activePlayers = useMemo(() => players.filter((p) => !p.left_at), [players]);
  const sortedTeams = useMemo(() => [...teams].sort((a, b) => b.score - a.score), [teams]);

  // ---- Sounds (louder on the TV; any tap or key press on the TV turns them on) ----
  useEffect(() => {
    setVolume(0.9);
    listenForUnlock();
  }, []);
  const getReadySecs = room?.phase === "question" ? Math.ceil(questionStart.remainingMs / 1000) : 0;
  useEffect(() => {
    if (getReadySecs >= 1 && getReadySecs <= 3) sounds.beep();
  }, [getReadySecs]);
  const tickSecs = room?.phase === "question" && questionStart.remainingMs <= 0 && !countdown.expired ? countdown.remainingSeconds : 0;
  useEffect(() => {
    if (tickSecs >= 1 && tickSecs <= 5) sounds.tick(tickSecs === 1);
  }, [tickSecs]);
  const revealKey = room?.phase === "reveal" ? room.current_question_index : -1;
  useEffect(() => {
    if (revealKey >= 0) sounds.reveal();
  }, [revealKey]);
  useEffect(() => {
    if (room?.phase === "reveal" && revealClock.reached) sounds.standings();
  }, [room?.phase, revealClock.reached]);
  useEffect(() => {
    if (room?.phase === "twist_intro") sounds.twist();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per intro
  }, [room?.phase, room?.current_question_index]);
  useEffect(() => {
    if (room?.phase !== "final") return;
    sounds.drumroll(2);
    const t = setTimeout(() => sounds.fanfare(), 2100);
    return () => clearTimeout(t);
  }, [room?.phase, room?.id]);
  const lobbyCount = room?.phase === "lobby" ? players.filter((p) => !p.left_at).length : 0;
  const prevLobbyCount = useRef(lobbyCount);
  useEffect(() => {
    if (lobbyCount > prevLobbyCount.current) sounds.join();
    prevLobbyCount.current = lobbyCount;
  }, [lobbyCount]);

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
      {nextGame && (room.phase !== "lobby" || activePlayers.length >= 40) && (
        <div className="fixed bottom-6 right-6 z-10 flex items-center gap-4 rounded-2xl bg-slate-900/95 border border-amber-400/40 p-3 pr-5 shadow-2xl">
          <JoinQRCode code={nextGame.o_code} venue={venue} size={110} />
          <div className="text-left">
            <p className="text-xs uppercase tracking-widest text-amber-400">Next game</p>
            <p className="text-2xl font-black tracking-widest">{nextGame.o_code}</p>
            <p className="text-sm text-slate-300">Scan to sign up</p>
            <p className="text-xs text-slate-500">
              {roundsToWaitLabel(nextGame.o_rounds_to_wait, nextGame)} · {nextGame.o_players} signed up
            </p>
          </div>
        </div>
      )}
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/10">
        <span className="font-black text-xl">
          Slim<span className="text-amber-400">pse</span>
        </span>
        <span className="text-slate-400">
          {activePlayers.length} player{activePlayers.length === 1 ? "" : "s"} · {teams.length} team
          {teams.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 text-center gap-8">
        {room.phase === "lobby" && (
          <>
            <JoinDrops players={players} teams={teams} avatars={avatarsById} big />
            <p className="text-4xl font-black">Scan with your phone camera to play</p>
            <ScanCards venue={venue} big />
            {/* Showing this screen on your own phone or laptop: join the same game without scanning. */}
            <div className="flex flex-col items-center gap-2">
              <Link
                href={`/play/${room.code}?venue=${encodeURIComponent(venue)}`}
                className="rounded-2xl bg-amber-400 text-black font-black text-2xl px-8 py-4 active:scale-95 transition"
              >
                Join this game on this device
              </Link>
            </div>
            {room.starts_at && !scheduledCountdown.reached ? (
              <p className="text-2xl text-slate-300">
                Trivia starts in <span className="text-amber-400 font-black tabular-nums">{scheduledCountdown.label}</span>
              </p>
            ) : (
              <p className="text-2xl text-slate-300">Trivia starts when the first player joins</p>
            )}
            <div className="w-full max-w-5xl">
              <ReadyLineup players={players} avatars={avatarsById} big />
            </div>
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
                          {t.name} <span className="text-sm font-normal text-slate-400">({members.length}/5)</span>
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

        {room.phase === "question" && question && questionStart.remainingMs > 0 && (
          <GetReady
            big
            title="Get ready! Question 1 is about"
            subtitle={room.winning_category_id ? packs[room.winning_category_id]?.name : "Trivia"}
            seconds={Math.ceil(questionStart.remainingMs / 1000)}
          />
        )}

        {room.phase === "sudden_death" && (
          <>
            <h2 className="text-7xl font-black text-rose-400 tracking-wide">SUDDEN DEATH</h2>
            <p className="text-2xl text-slate-300 max-w-3xl">
              Tie for 1st: {teams.filter((t) => room.sd_team_ids.includes(t.id)).map((t) => t.name).join(" vs ")}. One
              teammate from each team answers. Wrong while the other team is right, and you&apos;re out.
            </p>
            {sdStart.remainingMs > 0 ? (
              <>
                {(room.sd_last_result as unknown as SuddenDeathResult | null)?.round === room.sd_round - 1 && (
                  <SuddenDeathResultList big result={room.sd_last_result as unknown as SuddenDeathResult} avatars={avatarsById} />
                )}
                <GetReady big title={`Round ${room.sd_round}`} seconds={Math.ceil(sdStart.remainingMs / 1000)} />
              </>
            ) : (
              <>
                <div className="w-full max-w-3xl h-3 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-400 transition-[width] duration-100 linear" style={{ width: `${sdClock.fraction * 100}%` }} />
                </div>
                <h2 className="text-5xl font-bold max-w-4xl">{sdPrompt ?? "…"}</h2>
                <p className="text-xl text-slate-400">{sdClock.remainingSeconds}s</p>
              </>
            )}
            <div className="flex gap-10 justify-center">
              {players
                .filter((p) => room.sd_player_ids.includes(p.id))
                .map((p) => {
                  const a = p.avatar_id ? avatarsById[p.avatar_id] : undefined;
                  return (
                    <div key={p.id} className="flex flex-col items-center gap-2">
                      <Avatar emoji={a?.emoji} imageUrl={a?.imageUrl} size={140} variant="full" />
                      <p className="text-2xl font-bold">{p.nickname}</p>
                      <p className="text-lg text-slate-400">{teams.find((t) => t.id === p.team_id)?.name}</p>
                    </div>
                  );
                })}
            </div>
          </>
        )}

        {room.phase === "question" && question && questionStart.remainingMs <= 0 && (
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
            {twist && <TwistBanner big twist={twist} text={twistBanner(twist, question.twist_seq, twistCtx)} />}
            {twist === "captain" && question.captains && (
              <p className="text-xl text-fuchsia-200 max-w-4xl">
                Captains:{" "}
                {Object.entries(question.captains)
                  .map(([teamId, playerId]) => `${twistCtx.playerName(playerId)} (${twistCtx.teamName(teamId)})`)
                  .join(" · ")}
              </p>
            )}
            <h2 className="text-4xl font-bold max-w-3xl">{question.prompt}</h2>
            {twist === "sabotage" && fogs.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 max-w-4xl">
                {fogs.map((f) => (
                  <span key={f.id} className="rounded-full bg-sky-500/20 border border-sky-400/50 px-4 py-1 text-lg font-bold text-sky-100 animate-pop-in">
                    {twistCtx.teamName(f.from_team)} fogged {twistCtx.teamName(f.to_team)}!
                  </span>
                ))}
              </div>
            )}
            {/* Powers get their own column on the left, so the question never moves. */}
            <div className="fixed left-6 top-24 z-10 max-h-[70vh] overflow-hidden">
              <PowerFeed powers={roomPowers} who={powerWho} big />
            </div>
            {!isOpenFor(question, room.current_question_index) && question.choices?.length >= 2 ? (
              <div className="grid grid-cols-2 gap-3 w-full max-w-3xl">
                {shuffledChoices(question.choices, question.id).map((c, i) => (
                  <div key={c} className="rounded-2xl bg-white/10 border border-white/20 px-5 py-4 text-2xl font-bold text-left">
                    <span className="text-amber-400 mr-3">{"ABCD"[i]}</span>
                    {c}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xl text-sky-300 font-bold">Open answer · teams type it in</p>
            )}
            <div className="w-full max-w-5xl mt-4">
              <LockInStrip players={players} teams={teams} avatars={avatarsById} answered={answeredIds} big />
            </div>
          </>
        )}

        {room.phase === "twist_intro" && twist && (
          <TwistIntro
            big
            key={room.current_question_index}
            twist={twist}
            description={twistDescription(twist, twistCtx)}
            startedAt={room.phase_started_at}
          />
        )}

        {room.phase === "reveal" && (
          <>
            <p className="text-lg text-slate-400">
              Question {room.current_question_index + 1} of {totalQuestions || "?"} · Who got it
            </p>
            {twist && <TwistBanner big twist={twist} text={twistBanner(twist, question?.twist_seq, twistCtx)} />}
            {question && <h2 className="text-3xl font-bold max-w-4xl">{question.prompt}</h2>}
            {revealClock.reached ? (
              <>
                <RoundStandings roomId={room.id} questionIndex={room.current_question_index} players={players} avatars={avatarsById} powers={roomPowers} big />
                <FunFact roomId={room.id} questionIndex={room.current_question_index} big />
              </>
            ) : (
              reveal && (
                <div className="w-full max-w-6xl">
                  <PickYourCorner reveal={reveal} players={players} teams={teams} avatars={avatarsById} big />
                </div>
              )
            )}
          </>
        )}

        {room.phase === "final" && (
          <>
            <h2 className="text-4xl font-black text-amber-400">Final Results</h2>
            {room.sd_winner_team_id && (
              <p className="text-2xl font-bold text-rose-300">
                {teams.find((t) => t.id === room.sd_winner_team_id)?.name} won in sudden death (+100)
              </p>
            )}
            <Podium
              placed={sortedTeams.slice(0, 3).map((team, i) => ({ team, rank: i + 1 }))}
              teamCount={sortedTeams.length}
              players={players}
              avatars={avatarsById}
              big
            />
            <TeamStandings teams={sortedTeams} />
            {recap && <Recap recap={recap} />}
            <p className="text-slate-400">Next game boarding shortly…</p>
          </>
        )}
      </div>
    </main>
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
          <span className="text-amber-400 font-bold tabular-nums">{t.score.toLocaleString()}</span>
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
