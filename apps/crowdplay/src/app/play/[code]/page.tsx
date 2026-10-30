"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isOpenFor, secondsFor, shuffledChoices } from "@/lib/questionMode";
import { fogUntil, isTwist, twistBanner, twistDescription, twistPersonalLine, type TwistContext } from "@/lib/twists";
import { TwistBanner, TwistIntro } from "@/components/TwistIntro";
import { useFogs } from "@/hooks/useFogs";
import { usePowers, useRoomPowers } from "@/hooks/usePowers";
import { PowerPanel } from "@/components/PowerPanel";
import { powerErrorText } from "@/lib/powers";
import { RoundStandings } from "@/components/RoundStandings";
import { AdSlot, FunFact } from "@/components/RoundExtras";
import { listenForUnlock, sounds } from "@/lib/sounds";
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
import { playerKey, type PlayerCredentials, type FinalRecapRow, type SuddenDeathResult } from "@/lib/types";
import { randomFunName, funNameBatch } from "@/lib/funNames";
import { haptics } from "@/lib/haptics";
import { CategoryIcon } from "@/components/CategoryIcon";
import { useLiveTeams } from "@/components/LobbyRoster";
import { useTriviaQueue, roundsToWaitLabel, currentGameProgress } from "@/hooks/useTriviaQueue";
import { useAvatars, useEquippedAvatar, type AvatarOption } from "@/hooks/useAvatars";
import { JoinSteps, JOINED_BEFORE_KEY } from "@/components/JoinSteps";
import { CharacterBuddy, type CharacterMood } from "@/components/CharacterBuddy";
import { AvatarPicker } from "@/components/AvatarPicker";
import { Shoutouts } from "@/components/Shoutouts";
import { deviceKey } from "@/lib/device";
import { BuySheet } from "@/components/BuySheet";
import { JoinQRCode } from "@/components/JoinQRCode";
import { ReadyLineup } from "@/components/ReadyLineup";
import { Icon } from "@/components/Icon";
import { usePlayerVenue, useVenueName } from "@/lib/venue";
import { useSeason } from "@/hooks/useSeason";
import { Avatar } from "@/components/Avatar";
import { GetReady } from "@/components/GetReady";
import { SuddenDeathResultList } from "@/components/SuddenDeath";
import { useQuestionById } from "@/hooks/useQuestionById";
import { useAnsweredPlayers } from "@/hooks/useAnsweredPlayers";
import { useQuestionReveal } from "@/hooks/useQuestionReveal";
import { LockInStrip, PickYourCorner, RevealVerdict } from "@/components/RoomCharacters";
import { JoinDrops } from "@/components/JoinDrops";
import { Podium } from "@/components/Podium";
import { ShareCard } from "@/components/ShareCard";
import { EmoteCharacter, EmoteButtons } from "@/components/EmoteCharacter";
import { useRoomEmotes } from "@/hooks/useRoomEmotes";

const JOIN_ERRORS: Record<string, string> = {
  ROOM_NOT_FOUND: "That game code doesn't exist.",
  ROOM_ALREADY_STARTED: "That game just started. Tap Join for the next one.",
  TOO_MANY_JOINS: "Too many joins. Try again in a few seconds.",
  INVALID_NICKNAME: "Names need 1 to 30 characters.",
  NICKNAME_TAKEN: "Name taken in this game. Try another.",
  INVALID_TEAM_NAME: "Team names need 1 to 30 characters.",
  TEAM_NAME_TAKEN: "Team name taken. Try another.",
  TEAM_NOT_FOUND: "That team is gone. Pick another.",
  TEAM_LOCKED: "That team already started. Pick another.",
  TEAM_FULL: "That team is full (4 max).",
  USERNAME_TAKEN: "Someone just took that name, so here's a new one.",
  INVALID_USERNAME: "Usernames need 2 to 20 characters.",
  TOO_MANY_TEAMS: "All 8 teams taken. Join one or go solo.",
  ROOM_FULL: "Game full. Moving you to the next one…",
  AVATAR_REQUIRED: "Pick a character first.",
  AVATAR_LOCKED: "That character isn't unlocked. Pick another.",
  AVATAR_NOT_FOUND: "That character is gone. Pick another.",
};

const LAST_MODE_KEY = "crowdplay_last_mode";
const SUDDEN_DEATH_SECONDS = 20;
const REVEAL_PICKS_MS = 6000; // of the 12-second reveal (trivia tick), then the top 3 // matches trivia_sd_seconds() in the database

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
  const countdown = useCountdown(room?.question_started_at ?? null, secondsFor(question));
  const scheduledCountdown = useCountdownTo(room?.starts_at ?? null);
  // Question 1 opens with a few seconds of "Get ready" before its clock starts.
  const questionStart = useCountdownTo(room?.phase === "question" ? room.question_started_at : null);
  // Sudden death (a tie for 1st): its own get-ready, clock and question.
  const sdStart = useCountdownTo(room?.phase === "sudden_death" ? room.sd_started_at : null);
  const sdClock = useCountdown(room?.phase === "sudden_death" ? room.sd_started_at : null, SUDDEN_DEATH_SECONDS);
  const sdPrompt = useQuestionById(room?.phase === "sudden_death" ? room.sd_question_id : null);
  const [sdAnswer, setSdAnswer] = useState("");
  const [sdSentRound, setSdSentRound] = useState<number | null>(null);
  const [sdError, setSdError] = useState<string | null>(null);
  const totalQuestions = useTotalQuestions(room?.id, room?.phase);
  // Who's locked in (ids only), and after time's up, who picked what.
  const answeredIds = useAnsweredPlayers(room?.phase === "question" ? question?.id : undefined);
  const reveal = useQuestionReveal(room?.id, room?.phase, room?.current_question_index);
  const packs = useAllPacks();
  const voteTally = useCategoryVoteTally(room?.phase === "lobby" ? room?.id : undefined);
  // Realtime confirmation typically lands well under a second, but the tap
  // should feel instant regardless — bump the shown count immediately and
  // let the next real tally (which will already agree) replace it.
  const [displayTally, setDisplayTally] = useState<Record<string, number>>(voteTally);
  useEffect(() => setDisplayTally(voteTally), [voteTally]);

  // Lobbies lined up behind the game on now: where this room sits in line
  // (if it's queued), and where to send someone when this one is full.
  const queue = useTriviaQueue(room?.venue_id ?? null);
  const myQueueSpot = room?.queued ? queue.find((q) => q.o_room_id === room.id) : undefined;
  const queueProgress = currentGameProgress(myQueueSpot);

  const [creds, setCreds] = useState<PlayerCredentials | null>(null);
  const [credsChecked, setCredsChecked] = useState(false);
  // Opened a game that's already playing (or over) without being in it:
  // we look up the next game and take them to its lobby. "none" = no game open.
  const [forwarding, setForwarding] = useState<"looking" | "none" | null>(null);
  const [forwardTry, setForwardTry] = useState(0);
  // Character emotes, shared live with everyone in the game.
  const { plays: emotePlays, send: sendEmote } = useRoomEmotes(creds?.roomId, creds?.playerId);
  const { avatars, byId: avatarsById, refresh: refreshAvatars } = useAvatars();
  const [buying, setBuying] = useState<AvatarOption | null>(null);
  const venueSlug = usePlayerVenue();
  const venueName = useVenueName(room?.venue_id);
  // Monthly season: one username per phone per month, reset on the 1st.
  const { season, refresh: refreshSeason } = useSeason(venueSlug);
  const seasonName = season?.username ?? null;
  const [seasonTimedOut, setSeasonTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSeasonTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, []);
  const seasonLoaded = season !== null || seasonTimedOut;
  const [playedBefore, setPlayedBefore] = useState(false);
  useEffect(() => {
    try {
      setPlayedBefore(localStorage.getItem(JOINED_BEFORE_KEY) === "1");
    } catch {}
  }, []);
  const { avatarId, equip: equipAvatar } = useEquippedAvatar(avatars);
  const [avatarNote, setAvatarNote] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  // Free (untaken) generated usernames, used up one per Reroll.
  const [freeNames, setFreeNames] = useState<string[]>([]);
  // Scanned a team's QR code: name, then character, then straight onto that team.
  const [autoJoinTried, setAutoJoinTried] = useState(false);
  // How they want to play: pick on the join screen, or arrive with
  // ?mode=solo / ?mode=team from the "wait for the next game" screen.
  const [joinMode, setJoinMode] = useState<"solo" | "team">("solo");
  // null = default (open for a first-timer, closed for a returning player).
  // null: follow the default (shown while you're alone on a team you made).
  const [inviteOpen, setInviteOpen] = useState<boolean | null>(null);
  const [lobbyAvatarOpen, setLobbyAvatarOpen] = useState(false);
  const [rejoining, setRejoining] = useState(false);
  const [rejoinError, setRejoinError] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [sendingVote, setSendingVote] = useState(false);
  const [pendingVote, setPendingVote] = useState<{ questionId: string; text: string } | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [confirmingHint, setConfirmingHint] = useState(false);
  const [gettingHint, setGettingHint] = useState(false);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [confirmingQuit, setConfirmingQuit] = useState(false);
  const [recap, setRecap] = useState<FinalRecapRow[] | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const [awards, setAwards] = useState<{ icon: string; title: string; detail: string }[] | null>(null);
  const { votes: questionVotes, lock: teamLock, hint: teamHint, refresh: refreshVotes } = useQuestionVotes(
    room?.id,
    room?.phase === "question" ? question?.id : undefined,
    creds
  );

  // After each question: who picked what first, then the top 3 scores.
  const revealClock = useCountdownTo(
    room?.phase === "reveal" && room.phase_started_at ? new Date(Date.parse(room.phase_started_at) + REVEAL_PICKS_MS).toISOString() : null
  );
  const showStandings = room?.phase === "reveal" && revealClock.reached;

  // Game twists: names for the intro and banner, and live fogs on a sabotage question.
  const twist = isTwist(question?.twist) ? question.twist : null;
  const twistCtx: TwistContext = {
    // A team of one is a solo player: name the player.
    teamName: (id) => {
      const on = players.filter((p) => p.team_id === id && !p.left_at);
      return on.length === 1 ? on[0].nickname : teams.find((t) => t.id === id)?.name ?? "A team";
    },
    playerName: (id) => players.find((p) => p.id === id)?.nickname ?? "a teammate",
    myTeamId: creds?.teamId,
    myPlayerId: creds?.playerId,
    twistTeams: question?.twist_teams,
    captains: question?.captains,
  };
  const fogs = useFogs(
    room?.phase === "question" && twist === "sabotage" ? room.id : undefined,
    twist === "sabotage" ? question?.id : undefined
  );
  const myFogEnd = fogUntil(fogs, creds?.teamId);
  const fogClock = useCountdownTo(myFogEnd > 0 ? new Date(myFogEnd).toISOString() : null);
  const fogged = myFogEnd > 0 && fogClock.remainingMs > 0;
  const [throwingFog, setThrowingFog] = useState(false);
  const myCaptain = twist === "captain" && creds?.teamId ? question?.captains?.[creds.teamId] : undefined;
  // On a captain question everyone else on the team watches (unless the captain left).
  const notMyCall =
    !!myCaptain && myCaptain !== creds?.playerId && players.some((p) => p.id === myCaptain && !p.left_at);

  // Character powers: yours this game, and the one your team used on this question.
  const powers = usePowers(room?.id, room?.phase === "question" ? question?.id : undefined, creds);
  // Every team's powers on this question: a Void Rift aimed at your team, and the tags on the scores.
  const roomPowers = useRoomPowers(
    room?.phase === "question" || room?.phase === "reveal" ? room.id : undefined,
    question?.id
  );
  const riftOnMe = roomPowers.find((p) => p.power === "rift" && p.target_team_id === creds?.teamId);
  async function activatePower(): Promise<string | null> {
    if (!room || !creds || !question) return null;
    haptics.tap();
    const { error } = await supabase.rpc("use_power", {
      p_room_id: room.id,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
      p_question_id: question.id,
    });
    powers.refresh();
    refreshVotes();
    return error ? powerErrorText(error.message) : null;
  }

  async function throwFog(targetTeamId: string) {
    if (!room || !creds || throwingFog) return;
    setThrowingFog(true);
    haptics.tap();
    const { error } = await supabase.rpc("throw_fog", {
      p_room_id: room.id,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
      p_target_team_id: targetTeamId,
    });
    setThrowingFog(false);
    if (error && !/ALREADY_THROWN/.test(error.message)) setVoteError("Couldn't throw the fog. Try again.");
  }

  // ---- Sounds ----
  useEffect(() => listenForUnlock(), []);
  // Get-ready beeps (3, 2, 1) and the last-5-seconds tick.
  const getReadySecs = room?.phase === "question" ? Math.ceil(questionStart.remainingMs / 1000) : 0;
  useEffect(() => {
    if (getReadySecs >= 1 && getReadySecs <= 3) sounds.beep();
  }, [getReadySecs]);
  const tickSecs =
    room?.phase === "question" && questionStart.remainingMs <= 0 && !countdown.expired && teamLock === null
      ? countdown.remainingSeconds
      : 0;
  useEffect(() => {
    if (tickSecs >= 1 && tickSecs <= 5) sounds.tick(tickSecs === 1);
  }, [tickSecs]);
  // Locked in.
  const prevLock = useRef<string | null>(null);
  useEffect(() => {
    if (teamLock !== null && prevLock.current === null && room?.phase === "question") sounds.lock();
    prevLock.current = teamLock;
  }, [teamLock, room?.phase]);
  // The reveal: a whoosh, then right or wrong for your team.
  const myRevealPick = reveal && creds ? reveal.picks.find((r) => r.teamId === creds.teamId) : undefined;
  const revealKey = room?.phase === "reveal" && reveal ? room.current_question_index : -1;
  useEffect(() => {
    if (revealKey < 0) return;
    sounds.reveal();
    const t = setTimeout(() => {
      if (myRevealPick) (myRevealPick.teamCorrect ? sounds.correct : sounds.wrong)();
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealKey]);
  useEffect(() => {
    if (showStandings) sounds.standings();
  }, [showStandings]);

  useEffect(() => {
    if (room?.phase === "twist_intro") sounds.twist();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per intro
  }, [room?.phase, room?.current_question_index]);
  // Someone new joined the lobby.
  const lobbyCount = room?.phase === "lobby" ? players.filter((p) => !p.left_at).length : 0;
  const prevLobbyCount = useRef(lobbyCount);
  useEffect(() => {
    if (creds && lobbyCount > prevLobbyCount.current && prevLobbyCount.current > 0) sounds.join();
    prevLobbyCount.current = lobbyCount;
  }, [lobbyCount, creds]);

  // A buzz at 5 seconds left (once per question) if the team hasn't locked in.
  const buzzedFor = useRef<string | null>(null);
  useEffect(() => {
    if (room?.phase !== "question" || !creds || !question || teamLock !== null) return;
    if (countdown.expired || countdown.remainingSeconds > 5 || buzzedFor.current === question.id) return;
    buzzedFor.current = question.id;
    try {
      navigator.vibrate?.([150, 80, 150]);
    } catch {}
  }, [room?.phase, creds, question, teamLock, countdown.expired, countdown.remainingSeconds]);

  useEffect(() => {
    setNickname(randomFunName());
    setNewTeamName(`Team ${randomFunName()}`);
    const query = new URLSearchParams(window.location.search);
    const mode = query.get("mode");
    // Scanned a squad invite: go straight to joining that team.
    const invitedTeam = query.get("team");
    if (invitedTeam) {
      setJoinMode("team");
      setSelectedTeamId(invitedTeam);
      return;
    }
    // Solo unless the trivia landing asked for a team (?mode=team).
    if (mode === "team") setJoinMode("team");
  }, []);

  useEffect(() => {
    if (!code) return;
    const raw = localStorage.getItem(playerKey(code));
    if (raw) setCreds(JSON.parse(raw));
    setCredsChecked(true);
  }, [code]);

  // Reset per-question vote state whenever the room moves to a new question.
  useEffect(() => {
    setAnswerText("");
    setVoteError(null);
    setConfirmingHint(false);
  }, [room?.current_question_index]);

  // Reset per-room state whenever a fresh room (new code) shows up, e.g.
  // after "Play the next game" moves this phone into the next lobby.
  useEffect(() => {
    setMyVote(null);
    setRecap(null);
    setAwards(null);
    setRejoining(false);
    setRejoinError(null);
    setInviteOpen(null);
  }, [room?.id]);

  useEffect(() => {
    if (room?.phase !== "final" || !room.id || !creds || awards) return;
    supabase
      .rpc("get_player_awards", { p_room_id: room.id, p_player_id: creds.playerId, p_client_token: creds.clientToken })
      .then(({ data }) => {
        if (data) setAwards(data.map((a) => ({ icon: a.o_icon, title: a.o_title, detail: a.o_detail })));
      });
  }, [room?.phase, room?.id, creds, awards]);

  useEffect(() => {
    if (room?.phase !== "final" || !room.id || recap) return;
    supabase.rpc("get_final_recap", { p_room_id: room.id }).then(({ data }) => {
      if (data) setRecap(data as FinalRecapRow[]);
    });
  }, [room?.phase, room?.id, recap]);

  const activePlayers = useMemo(() => players.filter((p) => !p.left_at), [players]);

  const liveTeams = useLiveTeams(players, teams);

  const me = useMemo(() => players.find((p) => p.id === creds?.playerId), [players, creds]);
  // A solo game takes new players right up to its results.
  const soloOpen = !!room && room.mode === "solo" && !room.retired && room.phase !== "final";
  const myTeam = useMemo(() => teams.find((t) => t.id === creds?.teamId), [teams, creds]);
  // The lobby can move you to another team (solo play under 4 real players,
  // teams of 4 from then on): follow the server so your team is always right.
  useEffect(() => {
    if (!code || !creds || !me?.team_id || me.team_id === creds.teamId) return;
    const next = { ...creds, teamId: me.team_id, teamName: teams.find((t) => t.id === me.team_id)?.name ?? creds.teamName };
    setCreds(next);
    try {
      localStorage.setItem(playerKey(code), JSON.stringify(next));
    } catch {
      // storage blocked: the in-memory creds are enough for this visit
    }
  }, [code, creds, me?.team_id, teams]);
  const teammates = useMemo(
    () => activePlayers.filter((p) => p.team_id === creds?.teamId),
    [activePlayers, creds]
  );
  // Final standings: leave out empty teams with no points (everyone left
  // before scoring), but always keep your own team.
  const sortedTeams = useMemo(() => {
    const ranked = [...teams].sort((a, b) => b.score - a.score);
    const real = ranked.filter((t) => t.score > 0 || t.id === creds?.teamId);
    return real.length > 0 ? real : ranked;
  }, [teams, creds?.teamId]);
  const myTeamRank = creds ? sortedTeams.findIndex((t) => t.id === creds.teamId) + 1 : 0;

  // Kahoot-style podium reveal: 3rd, then 2nd, then a suspense beat, then
  // 1st -- only after all of that plays out do the rest of the standings,
  // the recap, and the way back to the menu show up.
  const topThree = useMemo(() => sortedTeams.slice(0, Math.min(3, sortedTeams.length)), [sortedTeams]);
  const restTeams = useMemo(() => sortedTeams.slice(topThree.length), [sortedTeams, topThree]);
  const revealOrder = useMemo(() => [...topThree].reverse(), [topThree]);
  const [revealCount, setRevealCount] = useState(0);
  const myRankRef = useRef(0);
  myRankRef.current = myTeamRank;
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
          sounds.drumroll(2.4);
          await sleep(2500);
          if (cancelled) return;
          setSuspense(false);
        }
        setRevealCount(i + 1);
        if (isWinner) {
          if (myRankRef.current === 1) sounds.fanfare();
          else sounds.gameOver();
        } else sounds.beep();
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

  // Premium avatars: buying is wired in with payments; until then, say so.
  function buyAvatar(a: AvatarOption) {
    setAvatarNote(null);
    setBuying(a);
  }

  function avatarBought() {
    if (!buying) return;
    const name = buying.name;
    setBuying(null);
    refreshAvatars();
    setAvatarNote(`${name} unlocked! Tap it to wear it.`);
  }

  const buySheet = buying && (
    <BuySheet
      item={{ itemType: "avatar", itemId: buying.id, name: buying.name, priceCents: buying.priceCents, emoji: buying.emoji, imageUrl: buying.imageUrl }}
      context={{
        venue: venueSlug ?? "main",
        nickname: creds ? undefined : nickname.trim() || undefined,
        roomId: creds?.roomId,
        playerId: creds?.playerId,
        clientToken: creds?.clientToken,
      }}
      onClose={() => setBuying(null)}
      onPaid={avatarBought}
    />
  );

  async function changeAvatar(id: string) {
    equipAvatar(id);
    setAvatarNote(null);
    if (!creds) return;
    const { error } = await supabase.rpc("set_player_avatar", {
      p_room_id: creds.roomId,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
      p_avatar_id: id,
      p_device_key: deviceKey(),
    });
    if (error) setAvatarNote("Couldn't switch characters. Try again.");
  }

  // A generated username nobody has this month. Checks a batch at a time
  // against the server and keeps the spares for the next Reroll.
  // Live check while a first-timer types: is this username free this month?
  const [nameStatus, setNameStatus] = useState<"checking" | "free" | "taken" | null>(null);
  useEffect(() => {
    const n = nickname.trim();
    if (seasonName || n.length < 2) {
      setNameStatus(null);
      return;
    }
    setNameStatus("checking");
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("free_season_usernames", { p_venue: venueSlug ?? "main", p_names: [n] });
      if (!cancelled) setNameStatus(data && data.length > 0 ? "free" : "taken");
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [nickname, seasonName, venueSlug]);

  async function rerollName() {
    let pool = freeNames;
    if (pool.length === 0) {
      const { data } = await supabase.rpc("free_season_usernames", {
        p_venue: venueSlug ?? "main",
        p_names: funNameBatch(12),
      });
      pool = (data ?? []).map((r) => r.o_username);
    }
    if (pool.length === 0) {
      setNickname(randomFunName());
      return;
    }
    setNickname(pool[0]);
    setFreeNames(pool.slice(1));
  }

  // First-timers start with a free generated name.
  useEffect(() => {
    if (season && !season.username) rerollName();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season?.username, season?.month]);

  // The next game with room at this venue: the first queued lobby, or the
  // open lobby if the game before it has already ended. A solo game's next
  // one is the venue's open solo game (they can be joined mid-game).
  async function nextGameCode(): Promise<string | null> {
    if (!room) return null;
    if (room.mode === "solo") {
      const { data: solo } = await supabase
        .from("rooms")
        .select("code")
        .eq("venue_id", room.venue_id)
        .eq("mode", "solo")
        .eq("retired", false)
        .neq("phase", "final")
        .neq("code", code!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return solo?.code ?? null;
    }
    const { data } = await supabase.rpc("trivia_queue", { p_venue_id: room.venue_id });
    const queued = (data ?? []).find((q) => !q.o_full && q.o_code !== code);
    if (queued) return queued.o_code;
    const { data: open } = await supabase
      .from("rooms")
      .select("code")
      .eq("venue_id", room.venue_id)
      .eq("mode", "team")
      .eq("phase", "lobby")
      .eq("retired", false)
      .neq("code", code!)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return open?.code ?? null;
  }

  // One join at a time: a quick double tap (or the scanned-QR auto-join
  // firing alongside a tap) must not put the same phone in the game twice.
  const joinInFlight = useRef(false);
  async function joinWith(characterId: string | null) {
    if (joinInFlight.current) return;
    joinInFlight.current = true;
    try {
      await joinWithOnce(characterId);
    } finally {
      joinInFlight.current = false;
    }
  }

  async function joinWithOnce(characterId: string | null) {
    const typedName = seasonName ?? nickname.trim();
    if (!code || typedName.length === 0) return;
    if (!characterId) {
      // Every game needs a character: open the picker.
      setJoinError(friendlyError("AVATAR_REQUIRED"));
      return;
    }
    setJoining(true);
    setJoinError(null);
    // First game of the month: lock in this season's username.
    let playName = typedName;
    if (!seasonName) {
      const claim = await supabase.rpc("claim_season_username", {
        p_device_key: deviceKey(),
        p_venue: venueSlug ?? "main",
        p_username: typedName,
      });
      if (claim.error || !claim.data?.[0]) {
        setJoining(false);
        setJoinError(friendlyError(claim.error?.message ?? ""));
        // Taken a moment ago by someone else: offer a fresh free name.
        if (claim.error?.message.includes("USERNAME_TAKEN")) {
          rerollName();
        }
        return;
      }
      playName = claim.data[0].o_username;
      refreshSeason();
    }
    // This game already started (or filled up): join the next one instead,
    // so nobody is turned away; its lobby shows "Next game" and the wait.
    let target = code;
    let teamId = joinMode === "team" && selectedTeamId ? selectedTeamId : undefined;
    if (room && room.phase !== "lobby" && !soloOpen) {
      target = (await nextGameCode()) ?? code;
      teamId = undefined; // a team picked here belongs to this game
    }
    let creating = joinMode === "team" && !teamId;
    let teamName = newTeamName.trim();
    const attempt = () =>
      supabase.rpc("join_room", {
        p_code: target,
        p_nickname: playName,
        p_team_id: teamId,
        p_new_team_name: creating ? teamName : undefined,
        p_avatar_id: characterId,
        p_device_key: deviceKey(),
      });
    let result = await attempt();
    if (result.error && /ROOM_ALREADY_STARTED|ROOM_FULL/.test(result.error.message)) {
      const next = await nextGameCode();
      if (next && next !== target) {
        target = next;
        if (teamId) {
          teamId = undefined;
          creating = joinMode === "team";
        }
        result = await attempt();
      }
    }
    // Team names are random, so a clash is just bad luck: roll another.
    for (let tries = 0; creating && tries < 3 && result.error?.message.includes("TEAM_NAME_TAKEN"); tries++) {
      teamName = `Team ${randomFunName()}`;
      setNewTeamName(teamName);
      result = await attempt();
    }
    const { data, error } = result;
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
    localStorage.setItem(playerKey(target), JSON.stringify(c));
    try {
      localStorage.setItem(LAST_MODE_KEY, joinMode);
      localStorage.setItem(JOINED_BEFORE_KEY, "1");
    } catch {}
    if (target !== code) {
      // Joined the next game: go to its lobby (it loads these credentials).
      if (creating) setInviteOpen(true);
      supabase.rpc("link_player_device", {
        p_room_id: c.roomId,
        p_player_id: c.playerId,
        p_client_token: c.clientToken,
        p_device_key: deviceKey(),
      });
      router.push(`/play/${target}`);
      return;
    }
    setCreds(c);
    // Made a new team: show their invite QR code straight away.
    if (creating) setInviteOpen(true);
    // Ties this player to the phone, so wins can be counted across games
    // (the "won 3 in a row" champion on the venue's QR display).
    supabase.rpc("link_player_device", {
      p_room_id: c.roomId,
      p_player_id: c.playerId,
      p_client_token: c.clientToken,
      p_device_key: deviceKey(),
    });
  }

  // What your team just scored, for the big right/wrong card at the reveal
  // (scores land a moment after the question closes, so read twice).
  const [myRoundPoints, setMyRoundPoints] = useState<number | null>(null);
  useEffect(() => {
    setMyRoundPoints(null);
    if (room?.phase !== "reveal" || !room.id || !creds?.teamId) return;
    const load = () =>
      supabase.rpc("get_round_standings", { p_room_id: room.id }).then(({ data }) => {
        const mine = data?.find((r) => r.o_team_id === creds.teamId);
        if (mine) setMyRoundPoints(mine.o_points);
      });
    load();
    const t = setTimeout(load, 1200);
    return () => clearTimeout(t);
  }, [room?.phase, room?.id, room?.current_question_index, creds?.teamId]);

  // "I'm ready" in the lobby: when every real player is, the game starts in 5 seconds.
  const [settingReady, setSettingReady] = useState(false);
  async function setReady(ready: boolean) {
    if (!room || !creds || settingReady) return;
    setSettingReady(true);
    haptics.tap();
    await supabase.rpc("set_player_ready", {
      p_room_id: room.id,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
      p_ready: ready,
    });
    setSettingReady(false);
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
    sounds.tap();
    setSendingVote(true);
    setVoteError(null);
    // Show the pick right away; the server confirms it a moment later.
    setPendingVote({ questionId: question.id, text: t });
    const args = {
      p_room_id: room.id,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
      p_question_id: question.id,
      p_answer_text: t,
    };
    let { error } = await supabase.rpc("cast_team_vote", args);
    // A busy moment on the server (a timeout or a dropped request): try again
    // rather than lose the vote.
    for (let i = 0; i < 2 && error && /statement timeout|fetch|network|Failed to/i.test(error.message); i++) {
      await new Promise((r) => setTimeout(r, 400));
      ({ error } = await supabase.rpc("cast_team_vote", args));
    }
    setSendingVote(false);
    if (error) {
      setPendingVote(null);
      if (/TEAM_LOCKED_IN/.test(error.message)) {
        refreshVotes();
        return;
      }
      setVoteError(
        /TIME_EXPIRED|NOT_ACCEPTING_ANSWERS|STALE_QUESTION/.test(error.message)
          ? "Too late. Time ran out."
          : /FOGGED/.test(error.message)
            ? "You're fogged! Wait a second and try again."
            : /NOT_CAPTAIN/.test(error.message)
              ? "Only your captain can answer this one."
              : "Didn't go through. Try again."
      );
      return;
    }
    setAnswerText(t);
    refreshVotes();
  }

  // Sudden death: one answer, no changing it.
  async function submitSuddenDeath(e: React.FormEvent) {
    e.preventDefault();
    if (!room || !creds || sdAnswer.trim().length === 0 || sdSentRound === room.sd_round) return;
    setSdError(null);
    const round = room.sd_round;
    const { error } = await supabase.rpc("submit_sudden_death_answer", {
      p_room_id: room.id,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
      p_answer_text: sdAnswer.trim(),
    });
    if (error) {
      setSdError(/VOTING_CLOSED/.test(error.message) ? "Time ran out before that landed." : "That didn't go through. Try again.");
      return;
    }
    haptics.tap();
    setSdSentRound(round);
    setSdAnswer("");
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
        ? "Too late for a hint."
        : "Couldn't get a hint. Try again.");
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

  // From the results screen: straight into the venue's next lobby, on the
  // same team (teammates who tap land together), same name and avatar.
  async function playNextSameTeam() {
    if (!creds || !code || rejoining) return;
    setRejoining(true);
    setRejoinError(null);
    const { data, error } = await supabase.rpc("rejoin_next_game", {
      p_room_id: creds.roomId,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
    });
    const row = data?.[0];
    if (error || !row) {
      setRejoining(false);
      setRejoinError(
        error?.message.includes("NO_NEXT_GAME")
          ? "Next game isn't open yet. Try again in a few seconds."
          : error?.message.includes("TEAM_FULL")
            ? "Your team is full in the next game."
            : error?.message.includes("TOO_MANY_TEAMS")
              ? "Next game's teams are full. Join solo from Trivia."
              : friendlyError(error?.message ?? "")
      );
      return;
    }
    const next: PlayerCredentials = {
      playerId: row.o_player_id,
      clientToken: row.o_client_token,
      roomId: row.o_room_id,
      teamId: row.o_team_id,
      teamName: row.o_team_name,
    };
    localStorage.setItem(playerKey(row.o_code), JSON.stringify(next));
    localStorage.removeItem(playerKey(code));
    router.push(`/play/${row.o_code}`);
  }

  // Waiting behind a game nobody real is playing (or about to join one in
  // progress): end that game so this one boards with a fresh countdown.
  const blockedByRunningGame = !!room && (room.queued || (!creds && room.phase !== "lobby" && !soloOpen));
  useEffect(() => {
    if (blockedByRunningGame && venueSlug) supabase.rpc("trivia_fresh_start", { p_venue: venueSlug });
  }, [blockedByRunningGame, venueSlug]);

  // Not in this game and it's already playing (or over): no error screen,
  // straight to the next game's lobby, where they get a confirmed spot.
  const shouldForward = !!room && credsChecked && !creds && (room.phase !== "lobby" || room.retired) && !soloOpen;
  useEffect(() => {
    if (!shouldForward) return;
    let cancelled = false;
    setForwarding("looking");
    (async () => {
      if (venueSlug) await supabase.rpc("trivia_fresh_start", { p_venue: venueSlug });
      const next = await nextGameCode();
      if (cancelled) return;
      if (next) router.replace(`/play/${next}`);
      else setForwarding("none");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldForward, venueSlug, forwardTry]);

  // A phone that already has this month's name and a character (it has
  // played here before): straight into the game, nothing to tap.
  useEffect(() => {
    if (autoJoinTried || creds || !credsChecked || shouldForward || !room || !seasonName || !avatarId) return;
    setAutoJoinTried(true);
    joinWith(avatarId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoinTried, creds, credsChecked, shouldForward, room?.id, seasonName, avatarId]);

  if (loading) return <Center text="Loading room…" />;
  if (notFound)
    return (
      <Center>
        <BackButton onClick={() => router.push("/")} />
        <h1 className="text-xl font-bold mb-2">That room doesn&apos;t exist</h1>
        <p className="text-slate-400 max-w-xs">Scan the QR code again.</p>
      </Center>
    );
  if (!room) return null;

  if (shouldForward || (!credsChecked && room.phase !== "lobby")) {
    if (forwarding === "none")
      return (
        <Center>
          <BackButton onClick={() => router.push("/")} />
          <h1 className="text-xl font-bold mb-2">This game is over</h1>
          <p className="text-slate-400 max-w-xs mb-5">The next one opens in a moment.</p>
          <button
            type="button"
            onClick={() => setForwardTry((n) => n + 1)}
            className="rounded-2xl bg-amber-400 text-black px-6 py-3 font-black active:scale-95 transition"
          >
            Find the next game
          </button>
        </Center>
      );
    return <Center text="Taking you to the next game…" />;
  }

  if (!creds) {
    const invitedTeam = selectedTeamId ? teams.find((t) => t.id === selectedTeamId) : undefined;
    const lobbyOpen = room.phase === "lobby" || soloOpen;
    const timing = room.queued ? (
      <p className="text-sm font-bold text-sky-200">Next game · {roundsToWaitLabel(myQueueSpot?.o_rounds_to_wait ?? 1, myQueueSpot)}</p>
    ) : !lobbyOpen ? (
      <p className="text-sm text-sky-200">A game is playing right now. You&apos;ll be in the next one.</p>
    ) : room.phase !== "lobby" ? (
      <p className="text-sm text-emerald-200">Game in progress · jump right in</p>
    ) : room.starts_at && !scheduledCountdown.reached ? (
      <p className="text-sm text-slate-300">
        Starts in <span className="font-bold text-amber-400 tabular-nums">{scheduledCountdown.label}</span>
      </p>
    ) : (
      <p className="text-sm text-slate-300">The countdown starts when the first player joins.</p>
    );
    // A phone with this month's name and a character joins on its own.
    if (!seasonLoaded || (seasonName && avatarId)) {
      const myAvatar = avatarId ? avatarsById[avatarId] : undefined;
      return (
        <Center>
          <BackButton onClick={() => leaveRoom("/")} />
          {!seasonLoaded ? (
            <p className="text-slate-400">Loading…</p>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Avatar emoji={myAvatar?.emoji} imageUrl={myAvatar?.imageUrl} size={140} variant="full" />
              <p className="text-xl font-black">Joining as {seasonName}…</p>
              {timing}
              {joinError && (
                <>
                  <p className="text-sm text-rose-300">{joinError}</p>
                  <button
                    type="button"
                    onClick={() => joinWith(avatarId)}
                    className="rounded-2xl bg-amber-400 text-black font-black px-6 py-3 active:scale-95 transition"
                  >
                    Try again
                  </button>
                </>
              )}
            </div>
          )}
        </Center>
      );
    }
    return (
      <Center>
        <BackButton onClick={() => leaveRoom("/")} />
        <JoinSteps
          heading={invitedTeam && lobbyOpen ? `Join ${invitedTeam.name}` : room.mode === "solo" ? "Solo trivia" : "Join trivia"}
          timing={timing}
          nickname={nickname}
          setNickname={setNickname}
          nameStatus={nameStatus}
          rerollName={rerollName}
          avatars={avatars}
          avatarId={avatarId}
          onPickAvatar={changeAvatar}
          playedBefore={playedBefore}
          joining={joining}
          joinError={joinError}
          joinLabel={lobbyOpen ? "Join the game" : "Join the next game"}
          onJoin={() => joinWith(avatarId)}
          soloGame={room.mode === "solo"}
        />
      </Center>
    );
  }

  if (room.phase === "lobby") {
    const showCountdown = room.starts_at && !scheduledCountdown.reached;
    const teamName = myTeam?.name ?? creds.teamName;
    const inviteShown = inviteOpen ?? false;
    const myCharacter = me?.avatar_id ? avatarsById[me.avatar_id] : avatarId ? avatarsById[avatarId] : undefined;
    // Team Play is always a team of 4 (bots fill open spots at the start);
    // the solo game is everyone for themselves.
    const teamGame = room.mode !== "solo";
    const mates = teammates.filter((p) => p.id !== creds.playerId);
    const openSpots = Math.max(0, 3 - mates.length);
    return (
      <Center>
        <BackButton onClick={() => leaveRoom("/")} />
        {buySheet}
        <JoinDrops players={players} teams={teams} avatars={avatarsById} excludeId={creds.playerId} />
        <div className="w-full max-w-sm flex flex-col gap-3 pt-16 pb-8">
          {/* You: your character, the clock, your Ready button, and your team's spots. */}
          <div className="rounded-3xl bg-indigo-950/90 border border-white/15 p-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center shrink-0">
                <button
                  type="button"
                  onClick={() => setLobbyAvatarOpen(!lobbyAvatarOpen)}
                  aria-label="Change your character"
                  className="active:scale-95 transition"
                >
                  <EmoteCharacter
                    avatarId={me?.avatar_id}
                    emoji={myCharacter?.emoji}
                    imageUrl={myCharacter?.imageUrl}
                    size={112}
                    play={emotePlays[creds.playerId]}
                  />
                </button>
                <EmoteButtons avatarId={me?.avatar_id} onPlay={sendEmote} small />
              </div>
              <div className="flex-1 min-w-0 flex flex-col items-center gap-2 text-center">
                <p className="text-lg font-black truncate max-w-full">{me?.nickname}</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-slate-200 max-w-full">
                  <Icon name={teamGame ? "users" : "user"} size={14} />
                  <span className="truncate">{teamGame ? teamName : "Solo"}</span>
                </span>
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Icon name="clock" size={22} />
                  {room.queued ? (
                    <span className="text-sm font-bold text-sky-300">Next game</span>
                  ) : showCountdown ? (
                    <span className="text-3xl font-black tabular-nums leading-none">{scheduledCountdown.label}</span>
                  ) : (
                    <span className="text-sm font-bold">Starting…</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setReady(!me?.ready)}
                  disabled={settingReady}
                  className={`w-full rounded-2xl py-3 font-black text-lg flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-60 ${
                    me?.ready ? "bg-emerald-400 text-black" : "bg-amber-400 text-black animate-pulse"
                  }`}
                >
                  <Icon name={me?.ready ? "check" : "hand"} size={22} strokeWidth={2.6} />
                  {me?.ready ? "Ready" : "I'm ready"}
                </button>
              </div>
            </div>
            {teamGame && (
              <div className="mt-3">
                <div className="flex justify-center gap-3">
                  {mates.slice(0, 3).map((p) => {
                    const a = p.avatar_id ? avatarsById[p.avatar_id] : undefined;
                    return (
                      <div key={p.id} className="flex flex-col items-center w-16">
                        <EmoteCharacter avatarId={p.avatar_id} emoji={a?.emoji} imageUrl={a?.imageUrl} size={56} play={emotePlays[p.id]} />
                        <span className="text-[11px] text-slate-200 truncate w-full text-center">{p.nickname}</span>
                      </div>
                    );
                  })}
                  {Array.from({ length: openSpots }).map((_, i) => (
                    <button
                      key={`open-${i}`}
                      type="button"
                      onClick={() => setInviteOpen(true)}
                      aria-label="Invite a friend to this spot"
                      className="flex flex-col items-center w-16 active:scale-95 transition"
                    >
                      <span className="w-14 h-14 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center text-white/50">
                        <Icon name="plus" size={22} />
                      </span>
                      <span className="text-[11px] text-slate-400 mt-0.5">Open</span>
                    </button>
                  ))}
                </div>
                {openSpots > 0 && <p className="mt-1 text-center text-[11px] text-slate-400">Open spots get bots at the start</p>}
              </div>
            )}
            <div className="mt-3 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setLobbyAvatarOpen(!lobbyAvatarOpen)}
                className={`rounded-xl py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 ${
                  lobbyAvatarOpen ? "bg-white text-black" : "bg-white/10 text-slate-200"
                }`}
              >
                <Icon name="swap" size={15} />
                Change character
              </button>
            </div>
          </div>

          {lobbyAvatarOpen && (
            <div className="flex flex-col items-center">
              <AvatarPicker avatars={avatars} selectedId={me?.avatar_id ?? avatarId} onSelect={changeAvatar} onBuy={buyAvatar} />
            </div>
          )}
          {avatarNote && <p className="text-xs text-amber-300/80">{avatarNote}</p>}

          {/* Friends scan this to get onto your team (team game only). */}
          {teamGame && (
          <button
            type="button"
            onClick={() => setInviteOpen(!inviteShown)}
            className={`w-full rounded-2xl py-4 text-lg font-black flex items-center justify-center gap-2 border-2 active:scale-95 transition ${
              inviteShown ? "bg-white/10 border-white/20 text-slate-200" : "bg-amber-400/15 border-amber-400/60 text-amber-300"
            }`}
          >
            <Icon name="qr" size={24} />
            {inviteShown ? "Hide" : openSpots > 0 ? `Invite friends · ${openSpots} open` : "Invite friends"}
          </button>
          )}
          {teamGame && inviteShown && (
            <div className="flex flex-col items-center gap-2 text-center">
              <JoinQRCode code={room.code} venue={venueSlug ?? "main"} team={creds.teamId} size={190} />
              <p className="text-sm text-slate-300">Scan to join your team</p>
            </div>
          )}

          {room.queued && (
            <div className="rounded-2xl bg-sky-500/10 border border-sky-400/40 px-4 py-3">
              <p className="font-bold text-sky-200">Next game · {roundsToWaitLabel(myQueueSpot?.o_rounds_to_wait ?? 1, myQueueSpot)}</p>
              {queueProgress && <p className="text-xs text-slate-400 mt-1">{queueProgress}</p>}
            </div>
          )}

          {room.category_options && room.category_options.length > 0 && (
            <div className="rounded-2xl bg-amber-400/10 border border-amber-400/30 p-3">
              <p className="flex items-center justify-center gap-1.5 text-sm font-black text-white mb-2">
                <Icon name={myVote ? "check" : "vote"} size={18} className={myVote ? "text-emerald-300" : "text-amber-300"} />
                {myVote ? "Voted" : "Pick a category"}
              </p>
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
          )}

          {/* Everyone else, with who's ready. */}
          {players.some((p) => !p.left_at && !p.is_bot && p.id !== creds.playerId) && (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
              <ReadyLineup players={players.filter((p) => p.id !== creds.playerId)} avatars={avatarsById} />
            </div>
          )}

          <Shoutouts roomId={room.id} creds={creds} />
        </div>
      </Center>
    );
  }

  if (room.phase === "question" && question && questionStart.remainingMs > 0) {
    const categoryName = room.winning_category_id ? packs[room.winning_category_id]?.name : undefined;
    return (
      <Center>
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
          <ExitButton onClick={() => setConfirmingQuit(true)} />
          <TeamBadge name={room.mode === "solo" ? "Solo" : myTeam?.name ?? creds.teamName} player={me?.nickname} score={myTeam?.score ?? 0} />
        </div>
        <GetReady title="Get ready! Question 1 is about" subtitle={categoryName ?? "Trivia"} seconds={Math.ceil(questionStart.remainingMs / 1000)} />
        {me?.avatar_id && avatarsById[me.avatar_id] && (
          <div className="mt-6">
            <CharacterBuddy
              emoji={avatarsById[me.avatar_id].emoji}
              imageUrl={avatarsById[me.avatar_id].imageUrl}
              mood="hop"
              size={110}
            />
          </div>
        )}
        {confirmingQuit && <QuitConfirm onCancel={() => setConfirmingQuit(false)} onConfirm={() => leaveRoom("/trivia")} />}
      </Center>
    );
  }

  if (room.phase === "sudden_death") {
    const tiedTeams = teams.filter((t) => room.sd_team_ids.includes(t.id));
    const upPlayers = players.filter((p) => room.sd_player_ids.includes(p.id));
    const iAmUp = room.sd_player_ids.includes(creds.playerId);
    const myTeamIn = !!creds.teamId && room.sd_team_ids.includes(creds.teamId);
    const myTeammateUp = upPlayers.find((p) => p.team_id === creds.teamId);
    const lastResult = room.sd_last_result as unknown as SuddenDeathResult | null;
    const waiting = sdStart.remainingMs > 0;
    const sent = sdSentRound === room.sd_round;
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center px-5 py-6 gap-5 text-center relative">
        <div className="w-full flex items-center justify-between">
          <ExitButton onClick={() => setConfirmingQuit(true)} />
          <TeamBadge name={room.mode === "solo" ? "Solo" : myTeam?.name ?? creds.teamName} player={me?.nickname} score={myTeam?.score ?? 0} />
        </div>
        <div>
          <p className="text-3xl font-black text-rose-400 tracking-wide">SUDDEN DEATH</p>
          <p className="text-sm text-slate-300 mt-1">
            {tiedTeams.map((t) => t.name).join(" vs ")} · wrong answer is out
          </p>
        </div>

        {waiting ? (
          <>
            {lastResult && lastResult.round === room.sd_round - 1 && (
              <SuddenDeathResultList result={lastResult} avatars={avatarsById} />
            )}
            <GetReady title={`Round ${room.sd_round}`} seconds={Math.ceil(sdStart.remainingMs / 1000)} />
          </>
        ) : (
          <>
            <div className="w-full max-w-sm h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-rose-400 transition-[width] duration-100 linear" style={{ width: `${sdClock.fraction * 100}%` }} />
            </div>
            <h2 className="text-xl font-bold max-w-sm">{sdPrompt ?? "…"}</h2>
          </>
        )}

        <div className="w-full max-w-sm flex flex-wrap justify-center gap-3">
          {upPlayers.map((p) => {
            const a = p.avatar_id ? avatarsById[p.avatar_id] : undefined;
            const team = teams.find((t) => t.id === p.team_id);
            return (
              <div key={p.id} className="flex flex-col items-center gap-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                <Avatar emoji={a?.emoji} imageUrl={a?.imageUrl} size={48} />
                <span className="text-sm font-bold">{p.id === creds.playerId ? "You" : p.nickname}</span>
                <span className="text-[11px] text-slate-400">{team?.name}</span>
              </div>
            );
          })}
        </div>

        {!waiting &&
          (iAmUp ? (
            sent ? (
              <p className="text-emerald-300 font-bold">Locked in. Waiting…</p>
            ) : (
              <form onSubmit={submitSuddenDeath} className="w-full max-w-sm flex flex-col gap-3">
                <p className="text-amber-300 font-bold">You&apos;re up! One answer.</p>
                <input
                  value={sdAnswer}
                  onChange={(e) => setSdAnswer(e.target.value)}
                  disabled={sdClock.expired}
                  maxLength={200}
                  autoComplete="off"
                  autoFocus
                  placeholder="Type your answer…"
                  className="w-full text-center text-lg font-semibold bg-white/10 border border-rose-400/60 rounded-2xl py-4 px-4 outline-none focus:border-rose-400"
                />
                <button
                  disabled={sdAnswer.trim().length === 0 || sdClock.expired}
                  className="rounded-2xl bg-rose-500 text-white font-black text-lg py-4 disabled:opacity-40 active:scale-95 transition"
                >
                  Lock it in · {sdClock.remainingSeconds}s
                </button>
                {sdError && <p className="text-sm text-rose-300">{sdError}</p>}
              </form>
            )
          ) : myTeamIn ? (
            <p className="text-slate-300">
              {myTeammateUp ? `${myTeammateUp.nickname} is up. No helping!` : "Your teammate is up."} ·{" "}
              {sdClock.remainingSeconds}s
            </p>
          ) : (
            <p className="text-slate-400">Tiebreaker · {sdClock.remainingSeconds}s</p>
          ))}
        {confirmingQuit && <QuitConfirm onCancel={() => setConfirmingQuit(false)} onConfirm={() => leaveRoom("/trivia")} />}
      </main>
    );
  }

  if (room.phase === "question" && question) {
    const myVote = (pendingVote?.questionId === question.id ? pendingVote.text : undefined) ?? questionVotes[creds.playerId];
    const teamOptions = groupTeamVotes(teammates, questionVotes, creds.playerId);
    const myCharacter = me?.avatar_id ? avatarsById[me.avatar_id] : undefined;
    const category = room.winning_category_id ? packs[room.winning_category_id] : undefined;
    const hintCost = question.hint_cost ?? 50;
    const open = isOpenFor(question, room.current_question_index) || (question.choices?.length ?? 0) < 2;
    const myFogThrown = fogs.some((f) => f.from_team === creds.teamId);
    const fogTargets = liveTeams.map((t) => t.team).filter((t) => t.id !== creds.teamId);
    const blocked = fogged || notMyCall;
    const buddyMood: CharacterMood = teamLock !== null ? "cheer" : myVote !== undefined ? "hop" : "idle";
    const locked = teamLock !== null;
    const urgent = countdown.fraction <= 0.2;
    const teamPower = powers.teamPower;
    // Trailblaze clears two wrong choices; Second Wind crosses out the wrong first answer.
    const struck = new Set(
      [
        ...(teamPower?.power === "trailblaze" ? teamPower.data.removed ?? [] : []),
        ...(teamPower?.power === "second_wind" && teamPower.data.result === "wrong" && teamPower.data.answer ? [teamPower.data.answer] : []),
      ].map(normalizeAnswer)
    );
    const choiceOrder = open ? [] : shuffledChoices(question.choices, question.id);
    const canVote =
      !locked &&
      !countdown.expired &&
      !sendingVote &&
      answerText.trim().length > 0 &&
      !(myVote !== undefined && normalizeAnswer(myVote) === normalizeAnswer(answerText));
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col px-4 py-4 gap-3 relative">
        <div className="flex items-center justify-between">
          <ExitButton onClick={() => setConfirmingQuit(true)} />
          <TeamBadge name={room.mode === "solo" ? "Solo" : myTeam?.name ?? creds.teamName} player={me?.nickname} score={myTeam?.score ?? 0} />
        </div>

        {/* One tight row: Q5/20 · Movies · 26s */}
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="text-slate-300 tabular-nums">
            Q{room.current_question_index + 1}
            {totalQuestions ? `/${totalQuestions}` : ""}
          </span>
          {category && (
            <>
              <span className="text-slate-600">·</span>
              <span className="flex items-center gap-1 min-w-0 text-slate-300">
                <CategoryIcon slug={category.icon} className="w-4 h-4 shrink-0 text-amber-400" />
                <span className="truncate">{category.name}</span>
              </span>
            </>
          )}
          <span
            className={`ml-auto text-4xl font-black tabular-nums leading-none ${urgent ? "text-red-400" : "text-amber-400"} ${
              !countdown.expired && countdown.remainingSeconds <= 5 ? "animate-pulse scale-110" : ""
            }`}
          >
            {countdown.remainingSeconds}s
          </span>
        </div>
        <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full transition-[width] duration-100 linear ${urgent ? "bg-red-400" : "bg-amber-400"}`}
            style={{ width: `${countdown.fraction * 100}%` }}
          />
        </div>
        {twist && <TwistBanner twist={twist} text={twistBanner(twist, question.twist_seq, twistCtx)} />}
        {riftOnMe && (
          <p className="rounded-xl bg-rose-500/15 border border-rose-400/50 px-4 py-2 text-center font-bold text-rose-100 animate-pop-in">
            {twistCtx.teamName(riftOnMe.team_id)} used Void Rift and stole {riftOnMe.amount} points from your team!
          </p>
        )}

        {/* The character beside the question. */}
        <div className="flex items-center gap-2">
          {myCharacter && (
            <div className="flex flex-col items-center gap-1 shrink-0">
              <CharacterBuddy
                emoji={myCharacter.emoji}
                imageUrl={myCharacter.imageUrl}
                mood={buddyMood}
                size={72}
                avatarId={me?.avatar_id}
                play={emotePlays[creds.playerId]}
              />
              <EmoteButtons avatarId={me?.avatar_id} onPlay={sendEmote} small />
            </div>
          )}
          <h2 className="flex-1 text-xl font-bold text-left">{question.prompt}</h2>
        </div>

        <div className="w-full max-w-sm mx-auto flex flex-col gap-3">
          {locked ? (
            <div className="rounded-2xl bg-emerald-500/15 border border-emerald-400/50 px-5 py-4 text-center">
              <p className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-widest text-emerald-300 mb-1">
                <Icon name="check" size={16} strokeWidth={3} />
                Locked in
              </p>
              <p className="text-2xl font-black break-words">{teamLock}</p>
            </div>
          ) : (
            !open ? (
              <div className="flex flex-col gap-2 relative">
                {fogged && (
                  <div className="absolute inset-0 z-10 rounded-2xl bg-slate-400/30 backdrop-blur-md flex flex-col items-center justify-center text-center">
                                        <span className="text-2xl font-black">Fogged!</span>
                    <span className="text-lg font-bold tabular-nums">{Math.ceil(fogClock.remainingMs / 1000)}…</span>
                  </div>
                )}
                {notMyCall && myCaptain && (
                  <p className="rounded-xl bg-fuchsia-500/15 border border-fuchsia-400/40 px-4 py-2 text-center font-bold text-fuchsia-200">
                    {twistCtx.playerName(myCaptain)} is answering for your team
                  </p>
                )}
                <div className="grid grid-cols-1 gap-2">
                  {choiceOrder.map((c) => {
                    const mine = myVote !== undefined && normalizeAnswer(myVote) === normalizeAnswer(c);
                    const gone = struck.has(normalizeAnswer(c));
                    const teamVotes = teamOptions.find((o) => normalizeAnswer(o.text) === normalizeAnswer(c))?.voters.length ?? 0;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => !mine && !gone && castVote(c)}
                        disabled={countdown.expired || sendingVote || blocked || gone}
                        className={`rounded-2xl px-4 py-4 text-xl font-black text-left transition active:scale-[0.98] border-2 ${
                          mine ? "bg-amber-400 text-black border-amber-400" : "bg-white/10 border-white/20 text-white"
                        } ${notMyCall && !mine ? "opacity-40" : ""} ${gone ? "opacity-25 line-through" : ""}`}
                      >
                        {c}
                        {/* Vote counts only mean something with teammates; alone, the yellow is enough. */}
                        {teamVotes > 0 && teammates.length > 1 && (
                          <span className={`float-right text-sm font-bold mt-1 ${mine ? "text-black/70" : "text-amber-300"}`}>
                            {teamVotes} {teamVotes === 1 ? "vote" : "votes"}
                            {mine ? " ✓" : ""}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {voteError && <p className="text-center text-sm text-rose-400">{voteError}</p>}
                {/* Sabotage: throw your team's one fog. */}
                {twist === "sabotage" && !countdown.expired && (
                  <div className="rounded-2xl bg-sky-500/10 border border-sky-400/40 px-3 py-3 text-center">
                    {myFogThrown ? (
                      <p className="font-bold text-sky-200">
                        Your team fogged {twistCtx.teamName(fogs.find((f) => f.from_team === creds.teamId)!.to_team)}
                      </p>
                    ) : (
                      <>
                        <p className="text-xs uppercase tracking-widest text-sky-300 mb-2">Throw your fog at</p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {fogTargets.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => throwFog(t.id)}
                              disabled={throwingFog}
                              className="rounded-full bg-sky-400 text-black font-black px-3 py-1.5 text-sm active:scale-95 transition disabled:opacity-50"
                            >
                              {t.name}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
            <form onSubmit={submitAnswer} className="flex flex-col gap-2">
              <input
                autoFocus
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                disabled={countdown.expired}
                maxLength={200}
                placeholder="Type your answer…"
                autoComplete="off"
                className="w-full text-center text-2xl font-bold bg-white/10 border-2 border-white/20 rounded-2xl py-5 px-4 outline-none focus:border-amber-400 disabled:opacity-50"
              />
              <button
                disabled={!canVote}
                className="rounded-2xl bg-amber-400 text-black font-black text-2xl py-5 disabled:opacity-40 active:scale-95 transition"
              >
                {sendingVote ? "Sending…" : !myVote ? "Lock in" : canVote ? "Switch to this" : "Sent ✓"}
              </button>
              {voteError && <p className="text-center text-sm text-rose-400">{voteError}</p>}
            </form>
            )
          )}
          {teamHint ? (
            <div className="rounded-2xl bg-sky-500/10 border border-sky-400/40 px-4 py-2.5 text-center">
              <p className="text-xs uppercase tracking-widest text-sky-300 mb-1">
                {teamPower?.power === "riddle" ? "Free clue · Riddle Sight" : `Hint used · −${hintCost} points if right`}
              </p>
              <p className="font-semibold">{teamHint}</p>
            </div>
          ) : !locked && !countdown.expired && !notMyCall && twist !== "lightning" ? (
            confirmingHint ? (
              <div className="rounded-2xl bg-white/5 border border-amber-400/40 px-4 py-3 text-center">
                <p className="text-sm text-slate-200 mb-3">
                  A clue costs {hintCost} points if you get it right.
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setConfirmingHint(false)} className="flex-1 rounded-xl bg-white/10 py-2 font-semibold">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={requestHint}
                    disabled={gettingHint}
                    className="flex-1 rounded-xl bg-amber-400 text-black py-2 font-bold disabled:opacity-50"
                  >
                    {gettingHint ? "…" : `Show clue −${hintCost}`}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingHint(true)}
                className="self-center rounded-full bg-sky-500/15 border border-sky-400/40 px-4 py-2 text-sm font-bold text-sky-200 active:scale-95 transition"
              >
                Clue? −{hintCost}
              </button>
            )
          ) : null}
          <PowerPanel
            myPower={powers.myPower}
            myUsedQuestion={powers.myUsedQuestion}
            questionId={question.id}
            teamPower={teamPower}
            usedByName={teamPower?.playerId === creds.playerId ? "You" : twistCtx.playerName(teamPower?.playerId ?? "")}
            locked={locked}
            answeredSolo={teammates.length <= 1 && myVote !== undefined}
            open={open}
            expired={countdown.expired}
            fogged={fogged}
            choices={choiceOrder}
            onUse={activatePower}
          />
        </div>

        <div className="w-full max-w-sm mx-auto">
          {/* Written answers with teammates: every answer your team typed, with
              its votes. Tap Vote to back one; the most votes is the team's answer. */}
          {teammates.length > 1 && open && (
            <div className="flex flex-col gap-2">
              <p className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-400">
                <Icon name="vote" size={15} />
                Vote for your team&apos;s answer
              </p>
              {teamOptions.length === 0 && <p className="text-center text-sm text-slate-400">No answers yet. Type yours above.</p>}
              {teamOptions.map((o, i) => {
                const voters = teammates.filter((p) => questionVotes[p.id] && normalizeAnswer(questionVotes[p.id]) === normalizeAnswer(o.text));
                const isTeamAnswer = i === 0 && (teamOptions.length === 1 || o.voters.length > teamOptions[1].voters.length);
                const canPick = !o.mine && !locked && !countdown.expired && !sendingVote && !blocked;
                return (
                  <button
                    key={o.text}
                    type="button"
                    onClick={() => canPick && castVote(o.text)}
                    disabled={!canPick}
                    className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left transition active:scale-[0.98] ${
                      o.mine ? "bg-amber-400/20 border-amber-400" : "bg-white/5 border-white/15"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-black break-words leading-tight">{o.text}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {voters.map((p) => {
                            const a = p.avatar_id ? avatarsById[p.avatar_id] : undefined;
                            return <Avatar key={p.id} emoji={a?.emoji} imageUrl={a?.imageUrl} size={24} />;
                          })}
                        </div>
                        <span className="text-xs text-slate-300">
                          {o.voters.length} vote{o.voters.length === 1 ? "" : "s"}
                        </span>
                        {isTeamAnswer && teamOptions.length > 1 && (
                          <span className="rounded-full bg-emerald-400 text-black text-[10px] font-black uppercase px-2 py-0.5">Team answer</span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-xl px-3 py-2 text-sm font-black ${
                        o.mine ? "bg-amber-400 text-black" : canPick ? "bg-white text-black" : "bg-white/10 text-slate-400"
                      }`}
                    >
                      {o.mine ? "Your vote ✓" : "Vote"}
                    </span>
                  </button>
                );
              })}
              {teammates.some((p) => !questionVotes[p.id]) && (
                <p className="flex items-center justify-center gap-2 text-xs text-slate-400">
                  Still thinking:
                  <span className="flex -space-x-2">
                    {teammates
                      .filter((p) => !questionVotes[p.id])
                      .map((p) => {
                        const a = p.avatar_id ? avatarsById[p.avatar_id] : undefined;
                        return <Avatar key={p.id} emoji={a?.emoji} imageUrl={a?.imageUrl} size={22} className="opacity-60" />;
                      })}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Multiple choice with teammates: one slim row per teammate (bots too): face, name, pick. */}
          {teammates.length > 1 && !open && (
          <>
          <p className="text-xs uppercase tracking-widest text-amber-400 text-center mb-2">Your team</p>
          <div className="flex flex-col gap-1.5">
            {teammates.map((p) => {
              const a = p.avatar_id ? avatarsById[p.avatar_id] : undefined;
              const v = questionVotes[p.id];
              const isMe = p.id === creds.playerId;
              const sameAsMine = !!v && !!myVote && normalizeAnswer(v) === normalizeAnswer(myVote);
              const votes = v ? teamOptions.find((o) => normalizeAnswer(o.text) === normalizeAnswer(v))?.voters.length ?? 1 : 0;
              const leading = !!v && teamOptions.length > 1 && normalizeAnswer(teamOptions[0].text) === normalizeAnswer(v)
                && teamOptions[0].voters.length > teamOptions[1].voters.length;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => v && !sameAsMine && castVote(v)}
                  disabled={!v || isMe || sameAsMine || locked || countdown.expired || sendingVote || blocked}
                  className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition active:scale-[0.98] ${
                    sameAsMine ? "bg-amber-400/20 border border-amber-400/50" : "bg-white/5 border border-white/10 hover:border-white/30"
                  }`}
                >
                  <Avatar emoji={a?.emoji} imageUrl={a?.imageUrl} size={30} className={v ? "" : "opacity-50"} />
                  <span className="w-16 shrink-0 text-xs text-slate-400 truncate">{isMe ? "You" : p.nickname}</span>
                  <span className="flex-1 min-w-0 truncate">
                    {v ? (
                      <span className="font-semibold">
                        {v}
                        {leading && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-amber-300">Leading</span>}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-500 italic">Thinking…</span>
                    )}
                  </span>
                  <span className="shrink-0 text-[11px] font-bold text-amber-300">
                    {!v || isMe
                      ? ""
                      : sameAsMine
                        ? "✓"
                        : locked || countdown.expired
                          ? `${votes} vote${votes === 1 ? "" : "s"}`
                          : `${votes} vote${votes === 1 ? "" : "s"} · Vote`}
                  </span>
                </button>
              );
            })}
          </div>
          </>
          )}
          <div className={teammates.length > 1 ? "mt-4 border-t border-white/10 pt-3" : ""}>
            <LockInStrip
              players={players}
              teams={teams}
              avatars={avatarsById}
              answered={answeredIds}
              myId={creds.playerId}
              myTeamId={creds.teamId}
            />
          </div>
          <div className="mt-3 flex justify-center">
            <Shoutouts roomId={room.id} creds={creds} compact />
          </div>
        </div>
        {confirmingQuit && <QuitConfirm onCancel={() => setConfirmingQuit(false)} onConfirm={() => leaveRoom("/trivia")} />}
      </main>
    );
  }

  // A game twist is next: 7 seconds saying what it is, then it fades into the question.
  if (room.phase === "twist_intro") {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col px-4 py-4 gap-3 relative">
        <div className="flex items-center justify-between">
          <ExitButton onClick={() => setConfirmingQuit(true)} />
          <TeamBadge name={room.mode === "solo" ? "Solo" : myTeam?.name ?? creds.teamName} player={me?.nickname} score={myTeam?.score ?? 0} />
        </div>
        {twist ? (
          <TwistIntro
            key={room.current_question_index}
            twist={twist}
            description={twistDescription(twist, twistCtx)}
            personal={twistPersonalLine(twist, twistCtx)}
            startedAt={room.phase_started_at}
          />
        ) : (
          <p className="flex-1 flex items-center justify-center text-2xl font-black text-amber-300">Game twist coming up…</p>
        )}
        {confirmingQuit && <QuitConfirm onCancel={() => setConfirmingQuit(false)} onConfirm={() => leaveRoom("/trivia")} />}
      </main>
    );
  }

  if (room.phase === "reveal") {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col px-4 py-4 gap-3 relative">
        <div className="flex items-center justify-between">
          <ExitButton onClick={() => setConfirmingQuit(true)} />
          <TeamBadge name={room.mode === "solo" ? "Solo" : myTeam?.name ?? creds.teamName} player={me?.nickname} score={myTeam?.score ?? 0} />
        </div>
        <p className="text-sm font-bold text-slate-400">
          Q{room.current_question_index + 1}
          {totalQuestions ? `/${totalQuestions}` : ""} · {showStandings ? "Scores" : "Who got it"}
        </p>
        {twist && <TwistBanner twist={twist} text={twistBanner(twist, question?.twist_seq, twistCtx)} />}
        {question && <h2 className="text-lg font-bold">{question.prompt}</h2>}
        {showStandings ? (
          <div className="flex-1 flex flex-col gap-3">
            {reveal && <RevealVerdict reveal={reveal} myId={creds.playerId} myTeamId={creds.teamId} myPoints={myRoundPoints} compact />}
            <RoundStandings roomId={room.id} questionIndex={room.current_question_index} myTeamId={creds.teamId} players={players} avatars={avatarsById} powers={roomPowers} />
            {/* A tip on the scores screen for the first two questions only. */}
            {room.current_question_index < 2 && (
              <p className="rounded-xl bg-sky-500/10 border border-sky-400/30 px-4 py-3 text-center text-sm text-sky-100 animate-pop-in">
                Faster right answers = more points
              </p>
            )}
            <FunFact roomId={room.id} questionIndex={room.current_question_index} />
            <div className="mt-auto pt-2 pb-14">
              <AdSlot venue={venueSlug ?? "main"} questionIndex={room.current_question_index} />
            </div>
          </div>
        ) : reveal ? (
          <PickYourCorner
            reveal={reveal}
            players={players}
            teams={teams}
            avatars={avatarsById}
            myId={creds.playerId}
            myTeamId={creds.teamId}
            myPoints={myRoundPoints}
          />
        ) : (
          <p className="text-center text-slate-400 py-10">Revealing…</p>
        )}
        {confirmingQuit && <QuitConfirm onCancel={() => setConfirmingQuit(false)} onConfirm={() => leaveRoom("/trivia")} />}
      </main>
    );
  }

  if (room.phase === "final") {
    const myRecap = recap?.filter((r) => r.o_team_id === creds.teamId) ?? [];
    return (
      <main className="min-h-screen bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white flex flex-col items-center px-6 pt-4 pb-36 text-center relative">
        <div className="self-start">
          <ExitButton onClick={() => leaveRoom("/trivia")} />
        </div>
        <h1 className="text-2xl font-bold mt-2 mb-4">Final Results</h1>
        {room.ended_reason === "idle" && (
          <p className="mb-4 rounded-full bg-white/10 px-4 py-1 text-sm text-slate-300">
            Game ended early: nobody answered for 3 questions
          </p>
        )}
        {room.sd_winner_team_id && (
          <p className="mb-4 rounded-full bg-rose-500/20 border border-rose-400/50 px-4 py-1 text-sm font-bold text-rose-200">
            {teams.find((t) => t.id === room.sd_winner_team_id)?.name} won in sudden death (+100)
          </p>
        )}

        <Podium
          placed={revealedPodium}
          teamCount={sortedTeams.length}
          players={players}
          avatars={avatarsById}
          myTeamId={creds.teamId}
        />

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
          <div className="w-full max-w-xs flex flex-col gap-4 mt-6 animate-pop-in">
            {/* Your place is on the card below (Champion, 2nd, ...), so no separate result box. */}
            {/* Personal awards: something for every player, even on a losing team. */}
            {awards && awards.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-widest text-amber-300">Your awards</p>
                {awards.slice(0, 3).map((a) => (
                  <div key={a.title} className="flex items-center gap-3 rounded-xl bg-amber-400/10 border border-amber-400/30 px-4 py-2.5 text-left">
                    <span className="shrink-0 w-11 h-11 rounded-full bg-amber-400 text-black flex items-center justify-center">
                      <Icon name={a.icon} size={24} strokeWidth={2.4} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-black">{a.title}</span>
                      <span className="block text-sm text-slate-300">{a.detail}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {myTeamRank > 0 && me && (
              <ShareCard
                rank={myTeamRank}
                venue={venueName ?? "the bar"}
                nickname={me.nickname}
                teamName={room.mode === "solo" ? null : myTeam?.name ?? creds.teamName}
                score={myTeam?.score ?? 0}
                imageUrl={me.avatar_id ? avatarsById[me.avatar_id]?.imageUrl : null}
              />
            )}

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
                      #{topThree.length + i + 1} {(() => {
                        // A team of one is a solo player: show their name.
                        const on = players.filter((p) => p.team_id === t.id);
                        return on.length === 1 ? on[0].nickname : t.name;
                      })()}
                    </span>
                    <span className="tabular-nums">{t.score.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            {myRecap.length > 0 && !recapOpen && (
              <button
                type="button"
                onClick={() => setRecapOpen(true)}
                className="rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm flex items-center justify-between"
              >
                <span>
                  Your answers:{" "}
                  <span className="font-bold text-emerald-400">
                    {myRecap.filter((r) => r.o_team_correct).length}/{myRecap.length} ✓
                  </span>
                </span>
                <span className="text-xs font-bold text-indigo-300">See all ▾</span>
              </button>
            )}
            {myRecap.length > 0 && recapOpen && (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                <button type="button" onClick={() => setRecapOpen(false)} className="text-xs uppercase tracking-widest text-slate-500 mb-1">
                  Your answers ▴
                </button>
                {myRecap.map((r) => (
                  <div key={r.o_question_order} className="rounded-xl bg-white/5 px-4 py-3 text-left">
                    <p className="text-sm font-semibold mb-1">{r.o_prompt}</p>
                    <p className="text-xs text-slate-400">
                      Answer: <span className="text-emerald-400">{r.o_correct_answer}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Your team:{" "}
                      <span className={r.o_team_correct ? "text-emerald-400" : "text-rose-400"}>
                        {r.o_team_answer ?? "No answer"}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => leaveRoom("/")} className="text-sm text-slate-400 underline">
              Back to Games
            </button>
          </div>
        )}

        {/* Play again stays pinned to the bottom so it's never hidden below the fold. */}
        {showRest && (
          <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black via-black/90 to-transparent pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] pl-4 pr-16">
            <button
              onClick={playNextSameTeam}
              disabled={rejoining}
              className="w-full max-w-xs mx-auto block rounded-2xl bg-amber-400 text-black font-black text-xl py-4 shadow-lg shadow-amber-400/20 disabled:opacity-50 active:scale-95 transition"
            >
              {rejoining ? "Getting you in…" : "Play again"}
            </button>
            {rejoinError && <p className="mt-1 text-center text-sm text-amber-300/90">{rejoinError}</p>}
          </div>
        )}
      </main>
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
      className={`relative rounded-xl border px-3 py-2.5 flex items-center gap-2 text-left transition active:scale-95 ${
        selected ? "bg-amber-400 text-black border-amber-400" : "bg-white/5 border-white/10"
      }`}
    >
      <CategoryIcon slug={icon} className={`w-5 h-5 shrink-0 ${selected ? "text-black" : "text-amber-400"}`} />
      <span className="flex-1 min-w-0 font-bold text-sm leading-tight">{name ?? "…"}</span>
      {count > 0 && (
        <span
          className={`shrink-0 min-w-[1.25rem] rounded-full px-1.5 text-center text-[11px] font-black ${
            selected ? "bg-black text-amber-400" : "bg-amber-400 text-black"
          }`}
        >
          {count}
        </span>
      )}
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

/** You and your team, top right during the game. */
/** Top corner during the game: who you are, your team (or Solo), and your
 * points so far, which update after every question. */
function TeamBadge({ name, player, score }: { name: string; player?: string; score?: number }) {
  return (
    <span className="max-w-[60%] rounded-2xl bg-amber-400/15 border border-amber-400/40 px-4 py-1.5 text-right leading-tight">
      {player && <span className="block text-sm font-black text-white truncate">{player}</span>}
      <span className="block text-xs font-bold text-amber-300 truncate">{name}</span>
      {score !== undefined && (
        <span key={score} className="flex items-center justify-end gap-1 text-lg font-black text-white tabular-nums animate-pop-in">
          <Icon name="star" size={15} className="text-amber-300" />
          {score.toLocaleString()}
        </span>
      )}
    </span>
  );
}

function QuitConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center px-6 z-50">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-xs w-full text-center">
        <p className="font-bold text-lg mb-1">Exit the game?</p>
        <p className="text-sm text-slate-400 mb-5">Your spot opens up for someone else.</p>
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
