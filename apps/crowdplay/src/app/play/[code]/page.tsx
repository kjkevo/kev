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
import { playerKey, type PlayerCredentials, type FinalRecapRow, type SuddenDeathResult } from "@/lib/types";
import { randomFunName, funNameBatch } from "@/lib/funNames";
import { haptics } from "@/lib/haptics";
import { CategoryIcon } from "@/components/CategoryIcon";
import { LobbyRoster, useLiveTeams, MAX_TEAMS, MAX_TEAM_SIZE, MIN_TEAM_SIZE } from "@/components/LobbyRoster";
import { useTriviaQueue, roundsToWaitLabel, currentGameProgress } from "@/hooks/useTriviaQueue";
import { useAvatars, useEquippedAvatar, type AvatarOption } from "@/hooks/useAvatars";
import { CharacterGate } from "@/components/CharacterGate";
import { CharacterBuddy, type CharacterMood } from "@/components/CharacterBuddy";
import { AvatarPicker } from "@/components/AvatarPicker";
import { Shoutouts } from "@/components/Shoutouts";
import { deviceKey } from "@/lib/device";
import { BuySheet } from "@/components/BuySheet";
import { SquadInvite } from "@/components/SquadInvite";
import { usePlayerVenue, useVenueName } from "@/lib/venue";
import { useSeason } from "@/hooks/useSeason";
import { SeasonChip } from "@/components/SeasonNotice";
import { Avatar } from "@/components/Avatar";
import { GetReady } from "@/components/GetReady";
import { SuddenDeathResultList } from "@/components/SuddenDeath";
import { useQuestionById } from "@/hooks/useQuestionById";
import { useAnsweredPlayers } from "@/hooks/useAnsweredPlayers";
import { useQuestionReveal } from "@/hooks/useQuestionReveal";
import { LockInStrip, PickYourCorner } from "@/components/RoomCharacters";
import { JoinDrops } from "@/components/JoinDrops";
import { Podium } from "@/components/Podium";
import { ShareCard } from "@/components/ShareCard";
import { EmoteCharacter, EmoteButtons } from "@/components/EmoteCharacter";
import { useRoomEmotes } from "@/hooks/useRoomEmotes";
import { emotesFor } from "@/lib/emotes";

const JOIN_ERRORS: Record<string, string> = {
  ROOM_NOT_FOUND: "That game code doesn't exist.",
  ROOM_ALREADY_STARTED: "Game already started. Wait for the next one.",
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
const SUDDEN_DEATH_SECONDS = 20; // matches trivia_sd_seconds() in the database

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
  const queue = useTriviaQueue(room?.phase === "lobby" ? room.venue_id : null);
  const myQueueSpot = room?.queued ? queue.find((q) => q.o_room_id === room.id) : undefined;
  const queueProgress = currentGameProgress(myQueueSpot);

  const [creds, setCreds] = useState<PlayerCredentials | null>(null);
  // Character emotes, shared live with everyone in the game.
  const { plays: emotePlays, send: sendEmote } = useRoomEmotes(creds?.roomId, creds?.playerId);
  const { avatars, byId: avatarsById, refresh: refreshAvatars } = useAvatars();
  const [buying, setBuying] = useState<AvatarOption | null>(null);
  const venueSlug = usePlayerVenue();
  const venueName = useVenueName(room?.venue_id);
  // Monthly season: one username per phone per month, reset on the 1st.
  const { season, refresh: refreshSeason } = useSeason(venueSlug);
  const seasonName = season?.username ?? null;
  const { avatarId, equip: equipAvatar } = useEquippedAvatar(avatars);
  const [avatarNote, setAvatarNote] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  // Free (untaken) generated usernames, used up one per Reroll.
  const [freeNames, setFreeNames] = useState<string[]>([]);
  // Scanned a team's QR code: name, then character, then straight onto that team.
  const [invited, setInvited] = useState(false);
  const [inviteStep, setInviteStep] = useState<"name" | "character">("name");
  const [autoJoinTried, setAutoJoinTried] = useState(false);
  // How they want to play: pick on the join screen, or arrive with
  // ?mode=solo / ?mode=team from the "wait for the next game" screen.
  const [joinMode, setJoinMode] = useState<"solo" | "team">("solo");
  // null = default (open for a first-timer, closed for a returning player).
  const [avatarOpen, setAvatarOpen] = useState<boolean | null>(null);
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
  const [voteError, setVoteError] = useState<string | null>(null);
  const [confirmingHint, setConfirmingHint] = useState(false);
  const [gettingHint, setGettingHint] = useState(false);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [confirmingQuit, setConfirmingQuit] = useState(false);
  const [recap, setRecap] = useState<FinalRecapRow[] | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const { votes: questionVotes, lock: teamLock, hint: teamHint, refresh: refreshVotes } = useQuestionVotes(
    room?.id,
    room?.phase === "question" ? question?.id : undefined,
    creds
  );

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
      setInvited(true);
      return;
    }
    // ?mode= from the trivia landing wins; otherwise however they played last.
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_MODE_KEY);
    } catch {}
    const pick = mode ?? last;
    if (pick === "solo" || pick === "team") setJoinMode(pick);
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

  // Reset per-room state whenever a fresh room (new code) shows up, e.g.
  // after "Play the next game" moves this phone into the next lobby.
  useEffect(() => {
    setMyVote(null);
    setRecap(null);
    setRejoining(false);
    setRejoinError(null);
    setInviteOpen(null);
  }, [room?.id]);

  useEffect(() => {
    if (room?.phase !== "final" || !room.id || recap) return;
    supabase.rpc("get_final_recap", { p_room_id: room.id }).then(({ data }) => {
      if (data) setRecap(data as FinalRecapRow[]);
    });
  }, [room?.phase, room?.id, recap]);

  const activePlayers = useMemo(() => players.filter((p) => !p.left_at), [players]);

  const joinableTeams = useMemo(
    () =>
      teams
        .filter((t) => t.kind === "self" && !t.locked)
        .map((t) => ({ ...t, memberCount: activePlayers.filter((p) => p.team_id === t.id).length }))
        .filter((t) => t.memberCount > 0 && t.memberCount < MAX_TEAM_SIZE),
    [teams, activePlayers]
  );
  const liveTeams = useLiveTeams(players, teams);
  const teamSpotsLeft = MAX_TEAMS - liveTeams.length;

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

  async function join(e: React.FormEvent) {
    e.preventDefault();
    await joinWith(avatarId);
  }

  async function joinWith(characterId: string | null) {
    const typedName = seasonName ?? nickname.trim();
    if (!code || typedName.length === 0) return;
    if (!characterId) {
      // Every game needs a character: open the picker.
      setAvatarOpen(true);
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
          setInvited(false);
        }
        return;
      }
      playName = claim.data[0].o_username;
      refreshSeason();
    }
    const creating = joinMode === "team" && !selectedTeamId;
    let teamName = newTeamName.trim();
    let result = await supabase.rpc("join_room", {
      p_code: code,
      p_nickname: playName,
      p_team_id: joinMode === "team" && selectedTeamId ? selectedTeamId : undefined,
      p_new_team_name: creating ? teamName : undefined,
      p_avatar_id: characterId,
      p_device_key: deviceKey(),
    });
    // Team names are random, so a clash is just bad luck: roll another.
    for (let tries = 0; creating && tries < 3 && result.error?.message.includes("TEAM_NAME_TAKEN"); tries++) {
      teamName = `Team ${randomFunName()}`;
      setNewTeamName(teamName);
      result = await supabase.rpc("join_room", {
        p_code: code,
        p_nickname: playName,
        p_new_team_name: teamName,
        p_avatar_id: characterId,
        p_device_key: deviceKey(),
      });
    }
    const { data, error } = result;
    setJoining(false);
    if (error || !data?.[0]) {
      setJoinError(friendlyError(error?.message ?? ""));
      // The invite didn't work (team full or gone): show the regular join screen.
      setInvited(false);
      // Full: go straight to the next game in line, keeping their choice.
      const next = queue.find((q) => !q.o_full && q.o_code !== code);
      if (error?.message.includes("ROOM_FULL") && next) {
        setTimeout(() => router.push(`/play/${next.o_code}?mode=${joinMode === "team" ? "team" : "solo"}`), 1500);
      }
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
    try {
      localStorage.setItem(LAST_MODE_KEY, joinMode);
    } catch {}
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
          ? "Too late. Time ran out."
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

  // Scanned a team QR and already has this month's name and a character:
  // straight onto that team, nothing to tap.
  useEffect(() => {
    if (!invited || autoJoinTried || creds || !room || room.phase !== "lobby" || !seasonName || !avatarId) return;
    setAutoJoinTried(true);
    joinWith(avatarId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invited, autoJoinTried, creds, room?.phase, seasonName, avatarId]);

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

  if (!creds) {
    const myAvatar = avatarId ? avatarsById[avatarId] : undefined;
    const invitedTeam = selectedTeamId ? teams.find((t) => t.id === selectedTeamId) : undefined;
    const playName = seasonName ?? nickname.trim();
    const cantCreateTeam = joinMode === "team" && !selectedTeamId && teamSpotsLeft <= 0;
    // The character picker stays out of the way until they tap Edit (or
    // try to join without a character, which every game needs).
    const pickerOpen = avatarOpen ?? false;
    const needsCharacter = avatars.length > 0 && !avatarId;

    // Scanned a teammate's QR code: name → character → on the team.
    if (invited && room.phase === "lobby") {
      const teamLabel = invitedTeam?.name ?? "your friend's team";
      const step = seasonName ? "character" : inviteStep;
      return (
        <Center>
          <BackButton onClick={() => leaveRoom("/")} />
          {buySheet}
          <div className="w-full max-w-sm flex flex-col gap-4 pt-16 pb-8">
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs uppercase tracking-widest text-slate-400">Joining</p>
              <h1 className="text-2xl font-black text-amber-300">{teamLabel}</h1>
              {!room.queued && room.starts_at && !scheduledCountdown.reached && (
                <p className="text-sm text-slate-400">
                  Starts in <span className="font-bold text-amber-400 tabular-nums">{scheduledCountdown.label}</span>
                </p>
              )}
            </div>

            {joining || (seasonName && avatarId) ? (
              <p className="text-lg font-bold text-amber-300">Joining {teamLabel}…</p>
            ) : step === "name" ? (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3">
                <p className="text-sm font-bold">Your name for {season?.month ?? "this month"}</p>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={20}
                  aria-label="Username"
                  className="w-full text-center text-2xl font-black bg-white/10 border border-white/20 rounded-xl px-3 py-3 outline-none focus:border-amber-400"
                />
                {nameStatus === "taken" ? (
                  <p className="text-xs font-bold text-rose-300">
                    Taken.{" "}
                    <button type="button" onClick={rerollName} className="underline text-amber-300">
                      Give me another
                    </button>
                  </p>
                ) : nameStatus === "free" ? (
                  <p className="text-xs font-bold text-emerald-300">✓ Available</p>
                ) : null}
                <button
                  type="button"
                  onClick={rerollName}
                  className="rounded-xl bg-white/10 py-2.5 text-sm font-bold active:scale-95 transition"
                >
                  🎲 Reroll
                </button>
                <button
                  type="button"
                  disabled={nickname.trim().length < 2 || nameStatus === "taken" || nameStatus === "checking"}
                  onClick={() => {
                    setJoinError(null);
                    setInviteStep("character");
                  }}
                  className="rounded-2xl bg-amber-400 text-black font-black text-lg py-4 disabled:opacity-40 active:scale-95 transition"
                >
                  Use this name
                </button>
              </div>
            ) : (
              <>
                {!seasonName && (
                  <button type="button" onClick={() => setInviteStep("name")} className="text-sm text-slate-300">
                    Playing as <span className="font-bold text-white">{nickname.trim()}</span> · <span className="text-amber-300">Change</span>
                  </button>
                )}
                {avatars.some((a) => a.owned && a.priceCents > 0) ? (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-lg font-black">Pick your character</p>
                    <AvatarPicker
                      avatars={avatars}
                      selectedId={avatarId}
                      onSelect={(id) => {
                        changeAvatar(id);
                        joinWith(id);
                      }}
                      onBuy={buyAvatar}
                    />
                  </div>
                ) : (
                  <CharacterGate
                    avatars={avatars}
                    onPick={(id) => {
                      changeAvatar(id);
                      joinWith(id);
                    }}
                    onBuy={buyAvatar}
                  />
                )}
              </>
            )}
            {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
          </div>
        </Center>
      );
    }

    return (
      <Center>
        <BackButton onClick={() => leaveRoom("/")} />
        {buySheet}
        <div className="w-full max-w-sm flex flex-col gap-4 pt-16 pb-8">
          <div className="flex flex-col items-center gap-1">
            {!room.queued && room.phase === "lobby" && room.starts_at && !scheduledCountdown.reached ? (
              <p className="text-6xl font-black text-amber-400 tabular-nums leading-none">{scheduledCountdown.label}</p>
            ) : (
              <h1 className="text-3xl font-black">Trivia</h1>
            )}
            {room.queued && (
              <p className="text-sm">
                <span className="text-amber-400 font-bold">Next game · {roundsToWaitLabel(myQueueSpot?.o_rounds_to_wait ?? 1)}</span>
                {queueProgress && <span className="block text-xs text-slate-400 mt-0.5">{queueProgress}</span>}
              </p>
            )}
            <SeasonChip season={season} />
          </div>

          <form onSubmit={join} className="flex flex-col gap-4">
            {/* Player card: this month's username and avatar. */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 flex items-center gap-3 text-left">
              <button
                type="button"
                onClick={() => setAvatarOpen(!pickerOpen)}
                aria-label={needsCharacter ? "Pick your character" : "Edit your character"}
                className="relative shrink-0 active:scale-95 transition"
              >
                {needsCharacter ? (
                  <span className="w-14 h-14 rounded-full bg-amber-400/20 ring-2 ring-amber-400 flex items-center justify-center text-2xl font-black text-amber-300">
                    ?
                  </span>
                ) : (
                  <Avatar emoji={myAvatar?.emoji} imageUrl={myAvatar?.imageUrl} size={56} />
                )}
              </button>
              <div className="flex-1 min-w-0">
                {seasonName ? (
                  <p className="text-lg font-bold truncate">{seasonName}</p>
                ) : (
                  <>
                    <label htmlFor="username" className="text-[11px] text-slate-400">
                      Username for {season?.month ?? "the month"}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        id="username"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        maxLength={20}
                        placeholder="Username"
                        className="flex-1 min-w-0 text-base font-bold bg-white/10 border border-white/20 rounded-xl px-2.5 py-1.5 outline-none focus:border-amber-400"
                      />
                      <button
                        type="button"
                        onClick={rerollName}
                        aria-label="Reroll username"
                        className="shrink-0 w-9 h-9 rounded-xl bg-white/10 text-lg active:scale-90 transition"
                      >
                        🎲
                      </button>
                    </div>
                    <div className="mt-1 min-h-[1rem]">
                      {nameStatus === "taken" ? (
                        <p className="text-xs font-bold text-rose-300">
                          Taken.{" "}
                          <button type="button" onClick={rerollName} className="underline text-amber-300">
                            Give me another
                          </button>
                        </p>
                      ) : nameStatus === "free" ? (
                        <p className="text-xs font-bold text-emerald-300">✓ Available</p>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setAvatarOpen(!pickerOpen)}
                className={`shrink-0 self-start rounded-full px-3 py-1 text-xs font-bold active:scale-95 transition ${
                  needsCharacter && !pickerOpen ? "bg-amber-400 text-black" : "bg-white/10 text-amber-300"
                }`}
              >
                {pickerOpen ? "Done" : needsCharacter ? "Pick" : "Edit"}
              </button>
            </div>
            {needsCharacter ? (
              pickerOpen && (
                <CharacterGate
                  avatars={avatars}
                  onPick={(id) => {
                    changeAvatar(id);
                    setAvatarOpen(false);
                    setJoinError(null);
                  }}
                  onBuy={buyAvatar}
                />
              )
            ) : pickerOpen && (
              <div>
                <AvatarPicker avatars={avatars} selectedId={avatarId} onSelect={changeAvatar} onBuy={buyAvatar} />
              </div>
            )}
            {avatarNote && <p className="text-xs text-amber-300/80 -mt-2">{avatarNote}</p>}

            {/* Solo or team, remembered from last time. */}
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/5 border border-white/10 p-1">
              {(["solo", "team"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setJoinMode(m);
                    if (m === "solo") setSelectedTeamId(null);
                    setJoinError(null);
                  }}
                  className={`rounded-xl py-2.5 text-sm font-bold transition ${
                    joinMode === m ? "bg-white text-black" : "text-slate-300"
                  }`}
                >
                  {m === "solo" ? "Solo" : "With friends"}
                </button>
              ))}
            </div>

            {joinMode === "team" && (
              <div className="flex flex-col gap-2 rounded-2xl bg-white/5 border border-white/10 p-3 text-left">
                {invitedTeam ? (
                  <p className="text-sm">
                    Joining <span className="font-bold text-amber-300">{invitedTeam.name}</span>
                  </p>
                ) : teamSpotsLeft > 0 ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-400">Your new team</p>
                      <p className="font-bold text-amber-300 truncate">{newTeamName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewTeamName(`Team ${randomFunName()}`)}
                      aria-label="Pick another team name"
                      className="text-xs font-bold px-3 h-8 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 transition"
                    >
                      Reroll
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-amber-300/80">All {MAX_TEAMS} teams taken. Join one below or go solo.</p>
                )}
                {joinableTeams.length > 0 && (
                  <>
                    <p className="text-[11px] text-slate-400 mt-1">Or join a friend&apos;s team</p>
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
                          {t.name} ({t.memberCount}/{MAX_TEAM_SIZE})
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <p className="text-[11px] text-slate-500">Friends scan your QR after you join.</p>
              </div>
            )}

            {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
            <button
              disabled={joining || playName.length === 0 || cantCreateTeam || (!seasonName && nameStatus === "taken")}
              className="rounded-2xl bg-amber-400 text-black font-black text-lg py-4 shadow-lg shadow-amber-400/20 disabled:opacity-40 active:scale-95 transition"
            >
              {joining
                ? "Joining…"
                : !avatarId
                  ? "Pick a character to join"
                  : `Join · ${joinMode === "solo" ? "Solo" : invitedTeam ? invitedTeam.name : "New team"}`}
            </button>
          </form>

          <LobbyRoster players={players} teams={teams} avatars={avatarsById} title="Who's in" collapsible />
        </div>
      </Center>
    );
  }

  if (room.phase === "lobby") {
    const showCountdown = room.starts_at && !scheduledCountdown.reached;
    const teamName = myTeam?.name ?? creds.teamName;
    const inviteShown = inviteOpen ?? (myTeam?.kind === "self" && teammates.length < MAX_TEAM_SIZE - 1);
    const canInvite = myTeam?.kind === "self" && teammates.length < MAX_TEAM_SIZE;
    const myCharacter = me?.avatar_id ? avatarsById[me.avatar_id] : avatarId ? avatarsById[avatarId] : undefined;
    return (
      <Center>
        <BackButton onClick={() => leaveRoom("/")} />
        {buySheet}
        <JoinDrops players={players} teams={teams} avatars={avatarsById} excludeId={creds.playerId} />
        <div className="w-full max-w-sm flex flex-col gap-3 pt-16 pb-8">
          {/* Pinned: you, your team and teammates, the countdown, and the invite QR. */}
          <div className="rounded-2xl bg-indigo-950/90 border border-white/15 p-3 shadow-lg text-left">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setLobbyAvatarOpen(!lobbyAvatarOpen)}
                aria-label="Change your character"
                className="relative shrink-0 active:scale-95 transition"
              >
                <Avatar emoji={myCharacter?.emoji} imageUrl={myCharacter?.imageUrl} size={48} />
                <span className="absolute -bottom-1 -right-1 rounded-full bg-amber-400 text-black text-[9px] font-black px-1.5 py-0.5">
                  {lobbyAvatarOpen ? "Done" : "Edit"}
                </span>
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 truncate">{me?.nickname}</p>
                <p className="font-bold truncate">{teamName}</p>
              </div>
              <div className="text-right shrink-0">
                {room.queued ? (
                  <p className="text-sm font-bold text-sky-300">Next game</p>
                ) : showCountdown ? (
                  <p className="text-3xl font-black text-amber-400 tabular-nums leading-none">{scheduledCountdown.label}</p>
                ) : (
                  <p className="text-sm font-bold text-amber-400">Starting…</p>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-start gap-3">
              <div className="flex-1 min-w-0 flex flex-wrap gap-x-1 gap-y-2 pt-1">
                {teammates.map((p) => {
                  const a = p.avatar_id ? avatarsById[p.avatar_id] : undefined;
                  return (
                    <span key={p.id} className="flex flex-col items-center w-16">
                      <span className="text-[11px] font-semibold text-slate-200 truncate w-full text-center">
                        {p.id === creds.playerId ? "You" : p.nickname}
                      </span>
                      <EmoteCharacter avatarId={p.avatar_id} emoji={a?.emoji} imageUrl={a?.imageUrl} size={60} play={emotePlays[p.id]} />
                    </span>
                  );
                })}
                {Array.from({ length: Math.max(0, MIN_TEAM_SIZE - teammates.length) }, (_, i) => (
                  <span key={`open-${i}`} className="flex flex-col items-center w-16">
                    <span className="text-[11px] text-slate-500">Open</span>
                    <span className="mt-1 w-9 h-[52px] rounded-t-full rounded-b-lg border-2 border-dashed border-white/25" />
                  </span>
                ))}
              </div>
              {canInvite && inviteShown && myTeam && (
                <SquadInvite
                  compact
                  code={room.code}
                  teamId={myTeam.id}
                  teamName={myTeam.name}
                  venue={venueSlug ?? "main"}
                  spotsLeft={MAX_TEAM_SIZE - teammates.length}
                />
              )}
            </div>
            {canInvite && (
              <button
                type="button"
                onClick={() => setInviteOpen(!inviteShown)}
                className="mt-2 text-xs font-bold text-amber-300"
              >
                {inviteShown ? "Hide QR" : "Invite friends"}
              </button>
            )}
            {teammates.length < MIN_TEAM_SIZE && (
              <p className="mt-1 text-[11px] text-slate-400">Open spots fill when the game starts.</p>
            )}
          </div>

          {/* Your character with its emotes (only characters that have some). */}
          {myCharacter && !lobbyAvatarOpen && emotesFor(me?.avatar_id).length > 0 && (
            <div className="flex flex-col items-center gap-2">
              <EmoteCharacter
                avatarId={me?.avatar_id}
                emoji={myCharacter.emoji}
                imageUrl={myCharacter.imageUrl}
                size={170}
                play={emotePlays[creds.playerId]}
                className="char-idle"
              />
              <EmoteButtons avatarId={me?.avatar_id} onPlay={sendEmote} />
            </div>
          )}

          {lobbyAvatarOpen && (
            <div className="flex flex-col items-center">
              <AvatarPicker avatars={avatars} selectedId={me?.avatar_id ?? avatarId} onSelect={changeAvatar} onBuy={buyAvatar} />
            </div>
          )}
          {avatarNote && <p className="text-xs text-amber-300/80">{avatarNote}</p>}

          {room.queued && (
            <div className="rounded-2xl bg-sky-500/10 border border-sky-400/40 px-4 py-3">
              <p className="font-bold text-sky-200">Next game · {roundsToWaitLabel(myQueueSpot?.o_rounds_to_wait ?? 1)}</p>
              {queueProgress && <p className="text-xs text-slate-400 mt-1">{queueProgress}</p>}
            </div>
          )}

          {room.category_options && room.category_options.length > 0 && (
            <div className="rounded-2xl bg-amber-400/10 border border-amber-400/30 p-3">
              <p className="text-sm font-bold text-white mb-2">Vote for a category</p>
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

          <Shoutouts roomId={room.id} creds={creds} />

          <LobbyRoster
            players={players}
            teams={teams}
            avatars={avatarsById}
            highlightTeamId={creds.teamId}
            title="Teams"
            collapsible
          />
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
          <TeamBadge name={myTeam?.name ?? creds.teamName} />
        </div>
        <GetReady title="Get ready! Question 1 is about" subtitle={categoryName ?? "Trivia"} seconds={Math.ceil(questionStart.remainingMs / 1000)} />
        {me?.avatar_id && avatarsById[me.avatar_id] && (
          <div className="mt-6">
            <CharacterBuddy
              emoji={avatarsById[me.avatar_id].emoji}
              imageUrl={avatarsById[me.avatar_id].imageUrl}
              mood="hop"
              says="Let's go!"
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
          <TeamBadge name={myTeam?.name ?? creds.teamName} />
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
    const myVote = questionVotes[creds.playerId];
    const teamOptions = groupTeamVotes(teammates, questionVotes, creds.playerId);
    const myCharacter = me?.avatar_id ? avatarsById[me.avatar_id] : undefined;
    const category = room.winning_category_id ? packs[room.winning_category_id] : undefined;
    const hintCost = question.hint_cost ?? 50;
    const buddyMood: CharacterMood = teamLock !== null ? "cheer" : myVote !== undefined ? "hop" : "idle";
    const buddySays =
      teamLock !== null
        ? "Locked in!"
        : countdown.expired
          ? "Time's up!"
          : myVote !== undefined
            ? "Sent!"
            : countdown.fraction < 0.25
              ? "Hurry!"
              : "Hmm…";
    const locked = teamLock !== null;
    const urgent = countdown.fraction <= 0.2;
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
          <TeamBadge name={myTeam?.name ?? creds.teamName} />
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
          <span className={`ml-auto text-2xl font-black tabular-nums ${urgent ? "text-red-400" : "text-amber-400"}`}>
            {countdown.remainingSeconds}s
          </span>
        </div>
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full transition-[width] duration-100 linear ${urgent ? "bg-red-400" : "bg-amber-400"}`}
            style={{ width: `${countdown.fraction * 100}%` }}
          />
        </div>

        {/* The character beside the question. */}
        <div className="flex items-center gap-2">
          {myCharacter && (
            <div className="flex flex-col items-center gap-1 shrink-0">
              <CharacterBuddy
                emoji={myCharacter.emoji}
                imageUrl={myCharacter.imageUrl}
                mood={buddyMood}
                says={buddySays}
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
              <p className="text-xs uppercase tracking-widest text-emerald-300 mb-1">Team locked in</p>
              <p className="text-2xl font-black break-words">{teamLock}</p>
            </div>
          ) : (
            <form onSubmit={submitAnswer} className="flex flex-col gap-2">
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
                {sendingVote ? "Sending…" : !myVote ? "Lock in" : canVote ? "Switch to this" : "Sent ✓"}
              </button>
              {voteError && <p className="text-center text-sm text-rose-400">{voteError}</p>}
            </form>
          )}
          {teamHint ? (
            <div className="rounded-2xl bg-sky-500/10 border border-sky-400/40 px-4 py-2.5 text-center">
              <p className="text-xs uppercase tracking-widest text-sky-300 mb-1">
                Hint · worth {(1000 - hintCost).toLocaleString()} now
              </p>
              <p className="font-semibold">{teamHint}</p>
            </div>
          ) : !locked && !countdown.expired ? (
            confirmingHint ? (
              <div className="rounded-2xl bg-white/5 border border-amber-400/40 px-4 py-3 text-center">
                <p className="text-sm text-slate-200 mb-3">
                  Narrows it to 2 for your team. Right answer: {(1000 - hintCost).toLocaleString()} instead of 1,000.
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
                    {gettingHint ? "Getting hint…" : `Show hint (−${hintCost})`}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmingHint(true)} className="text-sm text-sky-300 underline underline-offset-4">
                Hint (−{hintCost})
              </button>
            )
          ) : null}
        </div>

        <div className="w-full max-w-sm mx-auto">
          <p className="text-xs uppercase tracking-widest text-amber-400 mb-2 text-center">Your team</p>
          {/* One slim row per teammate (bots too): face, name, answer. */}
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
                  disabled={!v || isMe || sameAsMine || locked || countdown.expired || sendingVote}
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
                          : "Go with this"}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 border-t border-white/10 pt-3">
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

  if (room.phase === "reveal") {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col px-4 py-4 gap-3 relative">
        <div className="flex items-center justify-between">
          <ExitButton onClick={() => setConfirmingQuit(true)} />
          <TeamBadge name={myTeam?.name ?? creds.teamName} />
        </div>
        <p className="text-sm font-bold text-slate-400">
          Q{room.current_question_index + 1}
          {totalQuestions ? `/${totalQuestions}` : ""} · Who picked what
        </p>
        {question && <h2 className="text-lg font-bold">{question.prompt}</h2>}
        {reveal ? (
          <PickYourCorner
            reveal={reveal}
            players={players}
            teams={teams}
            avatars={avatarsById}
            myId={creds.playerId}
            myTeamId={creds.teamId}
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
      <Center>
        <div className="absolute top-4 left-4 z-10">
          <ExitButton onClick={() => leaveRoom("/trivia")} />
        </div>
        <h1 className="text-2xl font-bold mb-6 mt-16">Final Results</h1>
        {room.sd_winner_team_id && (
          <p className="-mt-4 mb-4 rounded-full bg-rose-500/20 border border-rose-400/50 px-4 py-1 text-sm font-bold text-rose-200">
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
          <div className="w-full max-w-xs flex flex-col gap-4 animate-pop-in">
            {/* Your character's reaction, beside a shareable card of your result. */}
            <div className="flex items-end justify-center gap-4">
              {me?.avatar_id && avatarsById[me.avatar_id] && (
                <CharacterBuddy
                  emoji={avatarsById[me.avatar_id].emoji}
                  imageUrl={avatarsById[me.avatar_id].imageUrl}
                  size={100}
                  {...finalReaction(myTeamRank, sortedTeams.length)}
                />
              )}
              {myTeamRank > 0 && me && (
                <ShareCard
                  rank={myTeamRank}
                  venue={venueName ?? "the bar"}
                  nickname={me.nickname}
                  teamName={myTeam?.name ?? creds.teamName}
                  score={myTeam?.score ?? 0}
                  imageUrl={me.avatar_id ? avatarsById[me.avatar_id]?.imageUrl : null}
                  emoji={me.avatar_id ? avatarsById[me.avatar_id]?.emoji : null}
                />
              )}
            </div>

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

            <button
              onClick={playNextSameTeam}
              disabled={rejoining}
              className="rounded-2xl bg-amber-400 text-black font-black text-lg py-4 shadow-lg shadow-amber-400/20 disabled:opacity-50 active:scale-95 transition"
            >
              {rejoining ? "Getting you in…" : "Play again"}
              <span className="block text-xs font-semibold text-black/70">Same team · {myTeam?.name ?? creds.teamName}</span>
            </button>
            {rejoinError && <p className="text-sm text-amber-300/90">{rejoinError}</p>}
            <button onClick={() => leaveRoom("/")} className="text-sm text-slate-400 underline">
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
/** How the character takes the final result. */
function finalReaction(rank: number, teamCount: number): { mood: CharacterMood; says: string } {
  if (rank === 1) return { mood: "cheer", says: "#1!" };
  if (teamCount > 2 && rank === teamCount) return { mood: "slump", says: `#${rank}` };
  if (rank > 0 && rank <= 3) return { mood: "hop", says: `#${rank}!` };
  return { mood: "idle", says: rank > 0 ? `#${rank}` : "Good game!" };
}

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
