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
import { LobbyRoster, useLiveTeams, MAX_TEAMS, MAX_TEAM_SIZE, MIN_TEAM_SIZE } from "@/components/LobbyRoster";
import { useTriviaQueue, roundsToWaitLabel, currentGameProgress } from "@/hooks/useTriviaQueue";
import { useAvatars, type AvatarOption } from "@/hooks/useAvatars";
import { AvatarPicker } from "@/components/AvatarPicker";
import { Shoutouts } from "@/components/Shoutouts";
import { deviceKey, rememberAvatar, rememberedAvatar } from "@/lib/device";
import { BuySheet } from "@/components/BuySheet";
import { SquadInvite } from "@/components/SquadInvite";
import { usePlayerVenue } from "@/lib/venue";
import { useSeason } from "@/hooks/useSeason";
import { SeasonNotice } from "@/components/SeasonNotice";
import { Avatar } from "@/components/Avatar";

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
  TEAM_FULL: "That team is already full (5 max). Join a different one.",
  USERNAME_TAKEN: "Someone already has that username this month. Try another.",
  INVALID_USERNAME: "Usernames need 2 to 20 characters.",
  TOO_MANY_TEAMS: "All 8 team spots are taken. Join a team with room, or play solo and we'll place you.",
  ROOM_FULL: "This game is full (8 teams of 5). Sending you to the next one…",
};

const LAST_MODE_KEY = "crowdplay_last_mode";

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

  // Lobbies lined up behind the game on now: where this room sits in line
  // (if it's queued), and where to send someone when this one is full.
  const queue = useTriviaQueue(room?.phase === "lobby" ? room.venue_id : null);
  const myQueueSpot = room?.queued ? queue.find((q) => q.o_room_id === room.id) : undefined;
  const queueProgress = currentGameProgress(myQueueSpot);

  const [creds, setCreds] = useState<PlayerCredentials | null>(null);
  const { avatars, byId: avatarsById, refresh: refreshAvatars } = useAvatars();
  const [buying, setBuying] = useState<AvatarOption | null>(null);
  const venueSlug = usePlayerVenue();
  // Monthly season: one username per phone per month, reset on the 1st.
  const { season, refresh: refreshSeason } = useSeason(venueSlug);
  const seasonName = season?.username ?? null;
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [avatarNote, setAvatarNote] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  // How they want to play: pick on the join screen, or arrive with
  // ?mode=solo / ?mode=team from the "wait for the next game" screen.
  const [joinMode, setJoinMode] = useState<"solo" | "team">("solo");
  // null = default (open for a first-timer, closed for a returning player).
  const [avatarOpen, setAvatarOpen] = useState<boolean | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
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
  const teamProgress = useTeamProgress(room?.phase === "question" ? room?.id : undefined, room?.phase === "question" ? question?.id : undefined);
  const { votes: questionVotes, lock: teamLock, hint: teamHint, refresh: refreshVotes } = useQuestionVotes(
    room?.id,
    room?.phase === "question" ? question?.id : undefined,
    creds
  );

  // Start from the avatar this phone used last time, else a random free one.
  useEffect(() => {
    if (avatarId || avatars.length === 0) return;
    const last = rememberedAvatar();
    const usable = avatars.filter((a) => a.owned);
    const pick = usable.find((a) => a.id === last) ?? usable[Math.floor(Math.random() * usable.length)];
    if (pick) setAvatarId(pick.id);
  }, [avatars, avatarId]);

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
    setInviteOpen(false);
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
    setAvatarNote(`${name} unlocked! Tap Equip to wear it. It's yours on this phone from now on.`);
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
    setAvatarId(id);
    rememberAvatar(id);
    setAvatarNote(null);
    if (!creds) return;
    const { error } = await supabase.rpc("set_player_avatar", {
      p_room_id: creds.roomId,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
      p_avatar_id: id,
      p_device_key: deviceKey(),
    });
    if (error) setAvatarNote("Couldn't switch avatars. Try again.");
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    const typedName = seasonName ?? nickname.trim();
    if (!code || typedName.length === 0) return;
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
    });
    // Team names are random, so a clash is just bad luck: roll another.
    for (let tries = 0; creating && tries < 3 && result.error?.message.includes("TEAM_NAME_TAKEN"); tries++) {
      teamName = `Team ${randomFunName()}`;
      setNewTeamName(teamName);
      result = await supabase.rpc("join_room", { p_code: code, p_nickname: playName, p_new_team_name: teamName });
    }
    const { data, error } = result;
    setJoining(false);
    if (error || !data?.[0]) {
      setJoinError(friendlyError(error?.message ?? ""));
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
    // Ties this player to the phone, so wins can be counted across games
    // (the "won 3 in a row" champion on the venue's QR display).
    supabase.rpc("link_player_device", {
      p_room_id: c.roomId,
      p_player_id: c.playerId,
      p_client_token: c.clientToken,
      p_device_key: deviceKey(),
    });
    if (avatarId) {
      rememberAvatar(avatarId);
      supabase.rpc("set_player_avatar", {
        p_room_id: c.roomId,
        p_player_id: c.playerId,
        p_client_token: c.clientToken,
        p_avatar_id: avatarId,
        p_device_key: deviceKey(),
      });
    }
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
          ? "The next game isn't open yet. Give it a few seconds and try again."
          : error?.message.includes("TEAM_FULL")
            ? "Your team is already full in the next game."
            : error?.message.includes("TOO_MANY_TEAMS")
              ? "All 8 team spots in the next game are taken. Head back to Trivia to join as a solo player."
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
    const myAvatar = avatarId ? avatarsById[avatarId] : undefined;
    const invitedTeam = selectedTeamId ? teams.find((t) => t.id === selectedTeamId) : undefined;
    const playName = seasonName ?? nickname.trim();
    const cantCreateTeam = joinMode === "team" && !selectedTeamId && teamSpotsLeft <= 0;
    // First game of the month: the avatar picker is open so they choose one.
    // Returning players keep theirs and can open it with "Change avatar".
    const pickerOpen = avatarOpen ?? !seasonName;
    return (
      <Center>
        <BackButton onClick={() => leaveRoom("/")} />
        {buySheet}
        <div className="w-full max-w-xs flex flex-col gap-4 py-16">
          <div>
            <h1 className="text-2xl font-black">
              Trivia
              {!room.queued && room.phase === "lobby" && room.starts_at && !scheduledCountdown.reached && (
                <>
                  {" "}· starts in <span className="text-amber-400 tabular-nums">{scheduledCountdown.label}</span>
                </>
              )}
            </h1>
            {room.queued && (
              <p className="text-sm mt-1">
                <span className="text-amber-400 font-bold">Next game. {roundsToWaitLabel(myQueueSpot?.o_rounds_to_wait ?? 1)}</span>
                {queueProgress && <span className="block text-xs text-slate-400 mt-0.5">{queueProgress}</span>}
              </p>
            )}
          </div>

          {!seasonName && <SeasonNotice season={season} compact />}

          <form onSubmit={join} className="flex flex-col gap-4">
            {/* Player card: this month's username and avatar. */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 flex items-center gap-3 text-left">
              <Avatar emoji={myAvatar?.emoji} imageUrl={myAvatar?.imageUrl} size={56} />
              <div className="flex-1 min-w-0">
                {seasonName ? (
                  <>
                    <p className="text-[11px] text-slate-400">Playing as</p>
                    <p className="text-lg font-bold truncate">{seasonName}</p>
                  </>
                ) : (
                  <>
                    <label htmlFor="username" className="text-[11px] text-slate-400">
                      Your {season?.month ?? "monthly"} username
                    </label>
                    <input
                      id="username"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      maxLength={20}
                      placeholder="Username"
                      className="w-full text-lg font-bold bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 outline-none focus:border-amber-400"
                    />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setAvatarOpen(!pickerOpen)}
                  className="text-xs font-bold text-amber-300 mt-1"
                >
                  {pickerOpen ? "Done choosing avatar" : "Change avatar"}
                </button>
              </div>
            </div>
            {!seasonName && (
              <p className="text-[11px] text-slate-500 -mt-2">
                You keep this name for every trivia game this month{season ? ` until ${season.resetsOn}` : ""}.
              </p>
            )}
            {pickerOpen && (
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

            {joinMode === "solo" ? (
              <p className="text-xs text-slate-400 -mt-2">
                We&apos;ll put you on a team with room ({MIN_TEAM_SIZE} to {MAX_TEAM_SIZE} people).
              </p>
            ) : (
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
                  <p className="text-xs text-amber-300/80">
                    All {MAX_TEAMS} team spots are taken, so no new teams this game. Join one below, or play solo.
                  </p>
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
                <p className="text-[11px] text-slate-500">
                  After you join you&apos;ll get a QR code your friends can scan to land on your team.
                </p>
              </div>
            )}

            {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
            <button
              disabled={joining || playName.length === 0 || cantCreateTeam}
              className="rounded-2xl bg-amber-400 text-black font-black text-lg py-4 shadow-lg shadow-amber-400/20 disabled:opacity-40 active:scale-95 transition"
            >
              {joining
                ? "Joining…"
                : `Join${playName ? ` as ${playName}` : ""} · ${
                    joinMode === "solo" ? "Solo" : invitedTeam ? invitedTeam.name : "New team"
                  }`}
            </button>
          </form>

          <LobbyRoster players={players} teams={teams} avatars={avatarsById} title="Who's in so far" collapsible />
        </div>
      </Center>
    );
  }

  if (room.phase === "lobby") {
    const showCountdown = room.starts_at && !scheduledCountdown.reached;
    const teamName = myTeam?.name ?? creds.teamName;
    return (
      <Center>
        <BackButton onClick={() => leaveRoom("/")} />
        {buySheet}
        <div className="w-full max-w-xs flex flex-col gap-4 py-16">
          {/* Pinned: which team you're on and when it starts. */}
          <div className="sticky top-3 z-20 rounded-2xl bg-indigo-950/90 backdrop-blur border border-white/15 px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg">
            <div className="min-w-0 text-left">
              <p className="text-[11px] text-slate-400 truncate">{me?.nickname} · you&apos;re on</p>
              <p className="font-bold truncate">{teamName}</p>
            </div>
            <div className="text-right shrink-0">
              {room.queued ? (
                <p className="text-sm font-bold text-sky-300">Next game</p>
              ) : showCountdown ? (
                <>
                  <p className="text-[11px] text-slate-400">Starts in</p>
                  <p className="text-xl font-black text-amber-400 tabular-nums leading-none">{scheduledCountdown.label}</p>
                </>
              ) : (
                <p className="text-sm font-bold text-amber-400">Starting…</p>
              )}
            </div>
          </div>

          {room.queued && (
            <div className="rounded-2xl bg-sky-500/10 border border-sky-400/40 px-4 py-3">
              <p className="font-bold text-sky-200">You&apos;re in the next game</p>
              <p className="text-sm text-slate-300">{roundsToWaitLabel(myQueueSpot?.o_rounds_to_wait ?? 1)}.</p>
              {queueProgress && <p className="text-xs text-slate-400 mt-1">{queueProgress}.</p>}
              <p className="text-xs text-slate-400 mt-1">
                Keep this page open. The countdown starts here the moment the game before yours ends.
              </p>
            </div>
          )}

          {room.category_options && room.category_options.length > 0 ? (
            <div className="rounded-2xl bg-amber-400/10 border border-amber-400/30 p-4">
              <p className="text-base font-bold text-white mb-1">Vote for tonight&apos;s category</p>
              <p className="text-xs text-slate-400 mb-3">
                {room.queued
                  ? "Voting stays open until your game starts."
                  : showCountdown
                    ? "Voting closes when the countdown ends."
                    : "This game runs itself. It starts automatically, whether people are here yet or not."}
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
          ) : (
            !showCountdown && (
              <p className="text-slate-400 text-sm">
                This game runs itself. It starts automatically, whether people are here yet or not.
              </p>
            )
          )}

          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <p className="text-xs uppercase tracking-widest text-amber-400 mb-2">Your team</p>
            <div className="flex flex-wrap gap-x-3 gap-y-2 justify-center">
              {teammates.map((p) => {
                const a = p.avatar_id ? avatarsById[p.avatar_id] : undefined;
                return (
                  <span key={p.id} className="flex items-center gap-1.5 text-sm">
                    <Avatar emoji={a?.emoji} imageUrl={a?.imageUrl} size={30} />
                    {p.nickname}
                  </span>
                );
              })}
            </div>
            {teammates.length < MIN_TEAM_SIZE && (
              <p className="text-xs text-amber-400/80 mt-2">
                {myTeam?.kind === "self"
                  ? "Invite a friend, or you'll be moved onto a team with room when the game starts."
                  : "Waiting for a teammate. If nobody joins, you'll be moved onto a team with room when the game starts."}
              </p>
            )}
            {myTeam?.kind === "self" && teammates.length < MAX_TEAM_SIZE && (
              <button
                type="button"
                onClick={() => setInviteOpen(!inviteOpen)}
                className="mt-3 w-full rounded-xl bg-amber-400 text-black font-bold py-2.5 active:scale-95 transition"
              >
                {inviteOpen ? "Hide invite" : "Invite friends"}
              </button>
            )}
            {myTeam?.kind === "self" && inviteOpen && (
              <div className="mt-3 flex justify-center">
                <SquadInvite
                  code={room.code}
                  teamId={myTeam.id}
                  teamName={myTeam.name}
                  venue={venueSlug ?? "main"}
                  spotsLeft={MAX_TEAM_SIZE - teammates.length}
                />
              </div>
            )}
          </div>

          <Shoutouts roomId={room.id} creds={creds} />

          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => setLobbyAvatarOpen(!lobbyAvatarOpen)}
              className="rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-bold active:scale-95 transition"
            >
              {lobbyAvatarOpen ? "Done" : "Change avatar"}
            </button>
            {lobbyAvatarOpen && (
              <div className="mt-3">
                <AvatarPicker avatars={avatars} selectedId={me?.avatar_id ?? avatarId} onSelect={changeAvatar} onBuy={buyAvatar} />
              </div>
            )}
            {avatarNote && <p className="text-xs text-amber-300/80 mt-2">{avatarNote}</p>}
          </div>

          <LobbyRoster
            players={players}
            teams={teams}
            avatars={avatarsById}
            highlightTeamId={creds.teamId}
            title="Teams so far"
            collapsible
          />
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
          <div className="mt-4 flex justify-center">
            <Shoutouts roomId={room.id} creds={creds} compact />
          </div>
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
              onClick={playNextSameTeam}
              disabled={rejoining}
              className="rounded-2xl bg-amber-400 text-black font-black text-lg py-4 shadow-lg shadow-amber-400/20 disabled:opacity-50 active:scale-95 transition"
            >
              {rejoining ? "Getting you in…" : "Play the next game"}
              <span className="block text-xs font-semibold text-black/70">Same team: {myTeam?.name ?? creds.teamName}</span>
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
