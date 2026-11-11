"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { deviceKey } from "@/lib/device";
import { usePlayerVenue, rememberPlayerVenue } from "@/lib/venue";
import { useAvatars, useEquippedAvatar } from "@/hooks/useAvatars";
import { useProgress } from "@/lib/progress";
import {
  SB_CALL_SECONDS,
  SB_POWERS,
  ensurePlayName,
  loadSbCreds,
  rememberSbPower,
  rememberedSbPower,
  saveSbCreds,
  sbError,
  sbHasLine,
  sbLetter,
  sbPower,
  sbCharPower,
  type SbCreds,
  type SbPowerKey,
  type SbState,
} from "@/lib/slimpseBingo";
import { Icon } from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { EmoteCharacter } from "@/components/EmoteCharacter";
import { CharacterLocker } from "@/components/CharacterLocker";
import { JoinQRCode } from "@/components/JoinQRCode";
import { LevelChip } from "@/components/LevelChip";
import { GameProgress } from "@/components/GameProgress";

export default function BingoPlayPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toUpperCase();
  const search = useSearchParams();
  const router = useRouter();
  const pageVenue = usePlayerVenue();
  const { avatars, byId } = useAvatars();
  const { avatarId, equip } = useEquippedAvatar(avatars);
  const { progress } = useProgress();

  const [creds, setCreds] = useState<SbCreds | null>(null);
  const [state, setState] = useState<SbState | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [tile, setTile] = useState<null | "power" | "qr" | "character">(null);
  // Tapping a square uses a power instead of marking (Lucky Square, Riddle Sight, Rebuild).
  const [pickMode, setPickMode] = useState<null | "perk" | "char">(null);
  const [probe, setProbe] = useState<{ nums: number[]; afterCalls: number } | null>(null);
  const [toasts, setToasts] = useState<{ id: string; text: string; mine: boolean }[]>([]);
  const seenUses = useRef<Set<string> | null>(null);
  const [peek, setPeek] = useState<{ next: number; afterCalls: number } | null>(null);
  const [pending, setPending] = useState<boolean[] | null>(null);
  const [calling, setCalling] = useState(false);
  const [, setTick] = useState(0);
  const joining = useRef(false);

  // The bar from the link (?venue=) is remembered, like Trivia.
  useEffect(() => {
    const v = search?.get("venue");
    if (v) rememberPlayerVenue(v);
  }, [search]);

  // Join on arrival: name and character are filled in for you, so it's one tap from the QR.
  useEffect(() => {
    if (!code || !avatarId || joining.current) return;
    const saved = loadSbCreds(code);
    if (saved) {
      setCreds(saved);
      return;
    }
    joining.current = true;
    (async () => {
      const venue = search?.get("venue") ?? pageVenue ?? "main";
      const name = await ensurePlayName(venue);
      const { data, error } = await supabase.rpc("sb_join", {
        p_code: code,
        p_nickname: name,
        p_avatar_id: avatarId,
        p_device_key: deviceKey(),
        p_team_id: search?.get("team") ?? undefined,
      });
      const row = data?.[0];
      if (error || !row) {
        joining.current = false;
        const msg = error?.message ?? "";
        const moved = msg.match(/MOVED_TO_([A-Z0-9]+)/);
        if (moved) {
          router.replace(`/bingo/play/${moved[1]}`);
          return;
        }
        // That game is over or (team) already started: hop into the open one.
        if (msg.includes("GAME_OVER") || msg.includes("ALREADY_STARTED") || msg.includes("TEAM_FULL")) {
          const mode = msg.includes("ALREADY_STARTED") || msg.includes("TEAM_FULL") ? "team" : "solo";
          const next = await supabase.rpc("sb_open", { p_venue: venue, p_mode: mode });
          const nextCode = next.data?.[0]?.o_code;
          if (nextCode && nextCode !== code) {
            router.replace(`/bingo/play/${nextCode}`);
            return;
          }
        }
        setJoinError(sbError(error));
        return;
      }
      const c = { roomId: row.o_room_id, playerId: row.o_player_id, clientToken: row.o_client_token, teamId: row.o_team_id };
      saveSbCreds(code, c);
      setCreds(c);
      // Bring the power-up picked last game.
      const want = rememberedSbPower();
      if (want) {
        supabase
          .rpc("sb_set_power", { p_room_id: c.roomId, p_player_id: c.playerId, p_client_token: c.clientToken, p_power: want, p_device_key: deviceKey() })
          .then(({ error: e }) => {
            if (e?.message.includes("POWER_LOCKED")) rememberSbPower(null);
          });
      }
    })();
  }, [code, avatarId, pageVenue, search, router]);

  // The game, read every second while numbers are being called.
  const load = useCallback(async () => {
    if (!creds) return;
    const { data } = await supabase.rpc("sb_state", { p_room_id: creds.roomId });
    if (!data) return;
    const s = data as unknown as SbState;
    if (s.room?.now) setOffsetMs(Date.parse(s.room.now) - Date.now());
    setState(s);
    setPending(null);
  }, [creds]);
  useEffect(() => {
    if (!creds) return;
    load();
    const ms = state?.room?.phase === "final" ? 4000 : 1000;
    const t = setInterval(load, ms);
    return () => clearInterval(t);
  }, [creds, load, state?.room?.phase]);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, []);

  const room = state?.room ?? null;
  const me = state?.players.find((p) => p.id === creds?.playerId);
  const myTeam = state?.teams.find((t) => t.id === creds?.teamId);
  const marks = pending ?? myTeam?.marks ?? [];
  const now = Date.now() + offsetMs;
  const calls = room?.calls ?? [];
  const current = calls[calls.length - 1];
  const teamMates = state?.players.filter((p) => p.team_id === creds?.teamId && p.id !== creds?.playerId && !p.left) ?? [];
  const lineReady = myTeam ? sbHasLine(marks) : false;

  // Sneak Peek: the number shows until it's called.
  useEffect(() => {
    if (!creds || !me?.power_used || me.power !== "peek" || peek) return;
    supabase.rpc("sb_my_power", { p_room_id: creds.roomId, p_player_id: creds.playerId, p_client_token: creds.clientToken }).then(({ data }) => {
      const d = (data as { data?: { next?: number; after_calls?: number } } | null)?.data;
      if (d?.next) setPeek({ next: d.next, afterCalls: d.after_calls ?? 0 });
    });
  }, [creds, me?.power_used, me?.power, peek]);
  const peekShown = peek && calls.length <= peek.afterCalls ? peek.next : null;

  // Mind Probe: the next 2 numbers show until they're called.
  useEffect(() => {
    if (!creds || !me?.char_used || me.char_power !== "probe" || probe) return;
    supabase.rpc("sb_my_power", { p_room_id: creds.roomId, p_player_id: creds.playerId, p_client_token: creds.clientToken }).then(({ data }) => {
      const d = (data as { char_data?: { next?: number[]; after_calls?: number } } | null)?.char_data;
      if (d?.next) setProbe({ nums: d.next, afterCalls: d.after_calls ?? 0 });
    });
  }, [creds, me?.char_used, me?.char_power, probe]);
  const probeShown = probe ? probe.nums.filter((_, k) => calls.length <= probe.afterCalls + k) : [];

  // Everyone in the game sees a small notice when someone uses a power (5 seconds).
  useEffect(() => {
    if (!state) return;
    const uses: { id: string; text: string; mine: boolean }[] = [];
    for (const p of state.players) {
      const who = p.id === creds?.playerId ? "You" : p.nickname;
      const mine = p.team_id === creds?.teamId;
      if (p.char_used) {
        const cp = sbCharPower(p.char_power);
        const target = p.char_data?.target_name ? ` on ${p.char_data.target_name}` : "";
        uses.push({ id: `c:${p.id}`, text: `${who} used ${cp?.name ?? "a power"}${target}`, mine });
      }
      if (p.power_used) uses.push({ id: `p:${p.id}`, text: `${who} used ${sbPower(p.power)?.name ?? "a perk"}`, mine });
    }
    if (seenUses.current === null) {
      // Uses from before this phone was watching don't pop up.
      seenUses.current = new Set(uses.map((u) => u.id));
      return;
    }
    const fresh = uses.filter((u) => !seenUses.current!.has(u.id));
    if (fresh.length === 0) return;
    fresh.forEach((u) => seenUses.current!.add(u.id));
    setToasts((prev) => [...prev, ...fresh].slice(-4));
    const ids = fresh.map((u) => u.id);
    setTimeout(() => setToasts((prev) => prev.filter((t) => !ids.includes(t.id))), 5000);
  }, [state, creds?.playerId, creds?.teamId]);

  async function mark(i: number) {
    if (!creds || !myTeam || !room || room.phase !== "playing" || i === 12) return;
    if (pickMode) {
      const which = pickMode;
      setPickMode(null);
      const { error } = await supabase.rpc(which === "perk" ? "sb_use_power" : "sb_use_char_power", {
        p_room_id: creds.roomId,
        p_player_id: creds.playerId,
        p_client_token: creds.clientToken,
        p_index: i + 1,
      });
      setNote(error ? sbError(error) : null);
      load();
      return;
    }
    const n = myTeam.card[i];
    if (!marks[i] && !calls.includes(n)) {
      setNote(`${sbLetter(n)} ${n} hasn't been called yet`);
      return;
    }
    const next = [...marks];
    next[i] = !next[i];
    setPending(next);
    setNote(null);
    const { error } = await supabase.rpc("sb_mark", {
      p_room_id: creds.roomId,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
      p_index: i + 1,
    });
    if (error) {
      setPending(null);
      setNote(sbError(error));
    }
  }

  async function bingo() {
    if (!creds) return;
    setCalling(true);
    const { error } = await supabase.rpc("sb_call_bingo", { p_room_id: creds.roomId, p_player_id: creds.playerId, p_client_token: creds.clientToken });
    setCalling(false);
    if (error) setNote(sbError(error));
    load();
  }

  async function usePower() {
    if (!creds || !me?.power) return;
    if (me.power === "wild") {
      setPickMode("perk");
      setNote("Tap any square to mark it");
      return;
    }
    const { data, error } = await supabase.rpc("sb_use_power", { p_room_id: creds.roomId, p_player_id: creds.playerId, p_client_token: creds.clientToken });
    if (error) {
      setNote(sbError(error));
      return;
    }
    const d = data as { next?: number; after_calls?: number } | null;
    if (me.power === "peek" && d?.next) setPeek({ next: d.next, afterCalls: d.after_calls ?? calls.length });
    if (me.power === "fresh") setNote("New card. Good luck!");
    load();
  }

  async function useCharPower() {
    const cp = sbCharPower(me?.char_power);
    if (!creds || !cp) return;
    if (cp.pick) {
      setPickMode("char");
      setNote(cp.pick === "any" ? "Tap any square to mark it" : "Tap an unmarked square to swap it");
      return;
    }
    const { data, error } = await supabase.rpc("sb_use_char_power", { p_room_id: creds.roomId, p_player_id: creds.playerId, p_client_token: creds.clientToken });
    if (error) {
      setNote(sbError(error));
      return;
    }
    const d = data as { next?: number[]; after_calls?: number; target_name?: string } | null;
    if (cp.key === "probe" && d?.next) setProbe({ nums: d.next, afterCalls: d.after_calls ?? calls.length });
    setNote(d?.target_name ? `${cp.name} hit ${d.target_name}` : `${cp.name} is on`);
    load();
  }

  async function pickPower(key: SbPowerKey | null) {
    if (!creds) return;
    const { error } = await supabase.rpc("sb_set_power", {
      p_room_id: creds.roomId,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
      p_power: key,
      p_device_key: deviceKey(),
    });
    if (error) {
      setNote(sbError(error));
      return;
    }
    rememberSbPower(key);
    load();
  }

  async function changeCharacter(id: string) {
    equip(id);
    if (!creds || !me) return;
    await supabase.rpc("sb_join", { p_code: code, p_nickname: me.nickname, p_avatar_id: id, p_device_key: deviceKey() });
    load();
  }

  async function playAgain() {
    if (!room) return;
    const { data } = await supabase.rpc("sb_again", { p_room_id: room.id });
    const next = data?.[0]?.o_code;
    if (next) router.push(`/bingo/play/${next}`);
  }

  async function startNow() {
    if (!creds) return;
    await supabase.rpc("sb_start_now", { p_room_id: creds.roomId, p_player_id: creds.playerId, p_client_token: creds.clientToken });
    load();
  }


  async function leave() {
    if (creds) await supabase.rpc("sb_leave", { p_room_id: creds.roomId, p_player_id: creds.playerId, p_client_token: creds.clientToken });
    router.push("/bingo");
  }

  const winnerTeam = state?.teams.find((t) => t.id === room?.winner_team_id);
  const winnerPlayers = state?.players.filter((p) => p.team_id === room?.winner_team_id) ?? [];

  const avatarsList = useMemo(() => byId, [byId]);

  if (joinError) {
    return (
      <Shell>
        <p className="text-lg font-bold">{joinError}</p>
        <button onClick={() => router.push("/bingo")} className="rounded-2xl bg-amber-400 text-black font-black px-6 py-3">
          Back to Bingo
        </button>
      </Shell>
    );
  }
  if (!room || !creds) {
    return (
      <Shell>
        <p className="text-slate-300">Getting you a card…</p>
      </Shell>
    );
  }

  const teamGame = room.mode === "team";
  const myChar = me?.avatar_id ? avatarsList[me.avatar_id] : undefined;
  const power = sbPower(me?.power);
  const charPower = sbCharPower(me?.char_power);
  const level = progress?.level ?? 1;

  // ---------- Results ----------
  if (room.phase === "final") {
    const iWon = room.winner_team_id === creds.teamId;
    const winChar = winnerPlayers[0]?.avatar_id ? avatarsList[winnerPlayers[0].avatar_id] : undefined;
    return (
      <Shell>
        <TopBar onExit={leave} label={teamGame ? "Team Bingo" : "Solo Bingo"} />
        <p className="text-sm uppercase tracking-widest text-amber-300">Final result</p>
        {winnerTeam ? (
          <>
            <h1 className="text-4xl font-black">{iWon ? "You got Bingo!" : `${teamGame ? winnerTeam.name : winnerPlayers[0]?.nickname ?? winnerTeam.name} got Bingo`}</h1>
            {!teamGame && winnerPlayers[0] && (
              <EmoteCharacter avatarId={winnerPlayers[0].avatar_id} emoji={winChar?.emoji} imageUrl={winChar?.imageUrl} size={200} play={null} />
            )}
            {teamGame && (
              <div className="rounded-2xl bg-amber-400/15 border border-amber-400/50 px-6 py-4">
                <p className="text-2xl font-black">{winnerTeam.name}</p>
                <p className="text-sm text-slate-300">{winnerPlayers.filter((p) => !p.is_bot).length > 0 ? winnerPlayers.map((p) => p.nickname).join(", ") : "Computer team"}</p>
              </div>
            )}
          </>
        ) : (
          <h1 className="text-3xl font-black">No Bingo this time</h1>
        )}
        <div className="w-full max-w-xs">
          <GameProgress roomId={room.id} avatars={avatarsList} />
        </div>
        <button onClick={playAgain} className="w-full max-w-xs rounded-2xl bg-amber-400 text-black font-black text-xl py-4 active:scale-95 transition">
          Play again
        </button>
        <button onClick={() => router.push("/")} className="text-sm text-slate-400 underline">
          Back to Games
        </button>
      </Shell>
    );
  }

  // ---------- Lobby ----------
  if (room.phase === "lobby") {
    const secs = room.starts_at ? Math.max(0, Math.ceil((Date.parse(room.starts_at) - now) / 1000)) : null;
    const humans = state?.players.filter((p) => !p.is_bot && !p.left).length ?? 0;
    const openSpots = Math.max(0, 3 - teamMates.length);
    return (
      <Shell>
        <TopBar onExit={leave} label={teamGame ? "Team Bingo" : "Solo Bingo"} />
        <div className="w-full max-w-sm rounded-3xl bg-indigo-950/90 border border-white/15 p-4 flex items-center gap-4">
          <EmoteCharacter avatarId={me?.avatar_id} emoji={myChar?.emoji} imageUrl={myChar?.imageUrl} size={110} play={null} />
          <div className="flex-1 min-w-0 flex flex-col items-center gap-2">
            <p className="text-lg font-black truncate max-w-full">{me?.nickname}</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold">
                <Icon name={teamGame ? "users" : "user"} size={14} />
                {teamGame ? myTeam?.name : "Solo"}
              </span>
              <LevelChip />
            </div>
            {room.private && secs === null ? (
              <p className="text-xl font-black text-amber-300">Waiting for friends</p>
            ) : (
              <div className="flex items-center gap-1.5 text-amber-400">
                <Icon name="clock" size={22} />
                <span className="text-3xl font-black tabular-nums">{secs === null ? "--" : `0:${String(secs).padStart(2, "0")}`}</span>
              </div>
            )}
            <p className="text-base font-bold text-white">
              {room.full ? "Starting soon!" : `${humans} ${humans === 1 ? "player" : "players"} here`}
            </p>
          </div>
        </div>
        {room.private && (secs === null || secs > 3) && (
          <button
            onClick={startNow}
            className="w-full max-w-sm rounded-2xl bg-emerald-400 text-black font-black text-2xl py-4 shadow-lg shadow-emerald-400/30 active:scale-95 transition"
          >
            Start now
          </button>
        )}
        {charPower && (
          <div className="w-full max-w-sm flex items-center gap-3 rounded-2xl bg-violet-500/15 border border-violet-400/40 px-4 py-2.5 text-left">
            <Icon name={charPower.icon} size={26} className="text-violet-200" />
            <span className="min-w-0">
              <span className="block text-sm font-bold text-violet-300">Your power</span>
              <span className="block text-xl font-black">{charPower.name}</span>
              <span className="block text-base text-white">{charPower.how}</span>
            </span>
          </div>
        )}

        {teamGame && (
          <div className="w-full max-w-sm flex justify-center gap-3">
            {teamMates.map((p) => {
              const a = p.avatar_id ? avatarsList[p.avatar_id] : undefined;
              return (
                <div key={p.id} className="flex flex-col items-center w-16">
                  <Avatar emoji={a?.emoji} imageUrl={a?.imageUrl} size={52} />
                  <span className="text-sm truncate w-full">{p.nickname}</span>
                </div>
              );
            })}
            {Array.from({ length: openSpots }).map((_, i) => (
              <button key={i} onClick={() => setTile("qr")} className="flex flex-col items-center w-16">
                <span className="w-[52px] h-[52px] rounded-full border-2 border-dashed border-white/30 flex items-center justify-center text-white/50">
                  <Icon name="plus" size={20} />
                </span>
                <span className="text-sm text-slate-300">Open</span>
              </button>
            ))}
          </div>
        )}

        <LobbyTiles
          teamGame={teamGame}
          powerName={power?.name ?? null}
          powerIcon={power?.icon ?? "bolt"}
          openSpots={openSpots}
          charName={myChar?.name ?? "Pick one"}
          charImage={myChar?.imageUrl ?? null}
          onOpen={setTile}
        />

        <p className="max-w-sm text-xl font-black">Tap the numbers. Get 5 in a row!</p>
        {note && <p className="text-sm font-bold text-amber-300">{note}</p>}

        {tile && tile !== "character" && (
          <Sheet title={tile === "power" ? "Perks" : teamGame ? "Invite friends" : "Scan to join"} onClose={() => setTile(null)}>
            {tile === "power" ? (
              <div className="flex flex-col gap-2">
                <p className="text-lg font-bold text-white">Pick 1</p>
                {Object.values(SB_POWERS).map((pw) => {
                  const locked = level < pw.level;
                  const on = me?.power === pw.key;
                  return (
                    <button
                      key={pw.key}
                      disabled={locked}
                      onClick={() => pickPower(on ? null : pw.key)}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-95 disabled:opacity-50 ${
                        on ? "bg-emerald-400/15 border-emerald-400/60" : "bg-white/5 border-white/10"
                      }`}
                    >
                      <Icon name={pw.icon} size={30} className={locked ? "text-slate-500" : "text-amber-300"} />
                      <span className="flex-1 min-w-0">
                        <span className="block font-black">{pw.name}</span>
                        <span className="block text-base text-white">{pw.how}</span>
                      </span>
                      <span className="text-sm font-bold text-slate-200">{locked ? `Level ${pw.level}` : on ? "On" : "Pick"}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <JoinQRCode code={room.code} basePath="/bingo/play" venue={room.venue ?? "main"} team={teamGame ? creds.teamId : undefined} size={220} />
                <p className="text-sm text-slate-300">{teamGame ? "Scan to join your team" : "Scan to join this game"}</p>
              </div>
            )}
          </Sheet>
        )}
        {tile === "character" && <CharacterLocker onClose={() => setTile(null)} onEquip={changeCharacter} />}
      </Shell>
    );
  }

  // ---------- Playing ----------
  const sinceCall = room.last_call_at ? (now - Date.parse(room.last_call_at)) / 1000 : 0;
  const nextIn = Math.max(0, Math.ceil(SB_CALL_SECONDS - sinceCall));

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white flex flex-col items-center px-4 pt-20 pb-8 gap-3">
      <TopBar onExit={leave} label={teamGame ? myTeam?.name ?? "Team Bingo" : "Solo Bingo"} />

      {/* The number just called, and the ones before it. */}
      <div className="flex items-center gap-4">
        <div className="w-28 h-28 rounded-full bg-amber-400 text-black flex flex-col items-center justify-center shadow-lg shadow-amber-400/30">
          {current ? (
            <>
              <span className="text-xl font-black leading-none">{sbLetter(current)}</span>
              <span className="text-5xl font-black leading-none tabular-nums">{current}</span>
            </>
          ) : (
            <span className="text-sm font-bold">Get ready</span>
          )}
        </div>
        <div className="flex flex-col items-start gap-1">
          <p className="text-base font-bold text-slate-200">Next in {nextIn}</p>
          <div className="flex gap-1">
            {calls.slice(-6, -1).reverse().map((n) => (
              <span key={n} className="w-10 h-10 rounded-full bg-white/10 flex flex-col items-center justify-center leading-none">
                <span className="text-[9px] text-slate-400">{sbLetter(n)}</span>
                <span className="text-sm font-black tabular-nums">{n}</span>
              </span>
            ))}
          </div>
          {probeShown.length > 0 && (
            <p className="rounded-full bg-violet-500/20 border border-violet-400/50 px-3 py-1 text-base font-bold text-violet-100">
              Next: {probeShown.map((n) => `${sbLetter(n)} ${n}`).join(", ")}
            </p>
          )}
          {peekShown && (
            <p className="rounded-full bg-sky-500/20 border border-sky-400/50 px-3 py-1 text-base font-bold text-sky-100">
              Next: {sbLetter(peekShown)} {peekShown}
            </p>
          )}
        </div>
      </div>

      {/* Your card. Called numbers glow until you tap them. */}
      <div className="w-full max-w-sm">
        <div className="grid grid-cols-5 gap-1.5 mb-1.5">
          {"BINGO".split("").map((l) => (
            <span key={l} className="text-center text-2xl font-black text-amber-300">{l}</span>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {(myTeam?.card ?? []).map((n, i) => {
            const free = i === 12;
            const on = marks[i];
            const called = calls.includes(n);
            return (
              <button
                key={i}
                type="button"
                onClick={() => mark(i)}
                className={`aspect-square rounded-xl flex items-center justify-center text-2xl font-black tabular-nums transition active:scale-90 ${
                  on
                    ? "bg-amber-400 text-black"
                    : pickMode
                      ? "bg-white/10 ring-2 ring-sky-400"
                      : called
                        ? "bg-white/10 ring-2 ring-amber-400/70 animate-pulse"
                        : "bg-white/[0.06] text-slate-200"
                }`}
              >
                {free ? <span className="text-xs font-black">FREE</span> : n}
              </button>
            );
          })}
        </div>
      </div>

      {myTeam?.frozen_until && Date.parse(myTeam.frozen_until) > now && (
        <p className="text-sm font-bold text-sky-200">Frozen! {Math.ceil((Date.parse(myTeam.frozen_until) - now) / 1000)}</p>
      )}
      {(myTeam?.auto_until ?? 0) > calls.length && (
        <p className="text-sm font-bold text-emerald-200">Auto-marking: {(myTeam?.auto_until ?? 0) - calls.length} left</p>
      )}
      {note && <p className="text-sm font-bold text-amber-300">{note}</p>}

      <button
        type="button"
        onClick={bingo}
        disabled={!lineReady || calling}
        className={`w-full max-w-sm rounded-2xl py-4 text-3xl font-black transition active:scale-95 ${
          lineReady ? "bg-emerald-400 text-black animate-pulse" : "bg-white/10 text-white/40"
        }`}
      >
        {calling ? "Checking…" : "BINGO!"}
      </button>

      {/* Your character's power and your perk, once each per game. */}
      <div className="w-full max-w-sm grid grid-cols-2 gap-2">
        {charPower && !me?.char_used ? (
          <button
            type="button"
            onClick={useCharPower}
            className="rounded-2xl bg-violet-500/20 border border-violet-400/60 px-3 py-2.5 text-sm font-bold text-violet-100 flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Icon name={charPower.icon} size={16} /> {charPower.name}
          </button>
        ) : (
          <span className="rounded-2xl bg-white/5 px-3 py-2.5 text-xs text-slate-500 text-center">{charPower ? `${charPower.name} used` : "No character power"}</span>
        )}
        {power && !me?.power_used ? (
          <button
            type="button"
            onClick={usePower}
            className="rounded-2xl bg-emerald-500/20 border border-emerald-400/60 px-3 py-2.5 text-sm font-bold text-emerald-100 flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Icon name={power.icon} size={16} /> {power.name}
          </button>
        ) : (
          <span className="rounded-2xl bg-white/5 px-3 py-2.5 text-xs text-slate-500 text-center">{power ? `${power.name} used` : "No perk"}</span>
        )}
      </div>
            {toasts.length > 0 && (
        <div className="fixed right-2 bottom-6 z-50 flex flex-col items-end gap-1.5 pointer-events-none">
          {toasts.map((t) => (
            <p
              key={t.id}
              className={`toast-slide-in max-w-[62vw] truncate rounded-full px-3 py-1.5 text-xs font-bold shadow-lg ${
                t.mine ? "bg-violet-600/95 border border-violet-300/80" : "bg-slate-800/95 border border-white/20"
              }`}
            >
              {t.text}
            </p>
          ))}
        </div>
      )}
      {teamGame && teamMates.length > 0 && (
        <p className="text-base text-slate-200">Team: {teamMates.map((p) => p.nickname).join(", ")}</p>
      )}
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white px-4 py-16 text-center">
      {children}
    </main>
  );
}

function TopBar({ onExit, label }: { onExit: () => void; label: string }) {
  return (
    <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
      <button onClick={onExit} className="rounded-full bg-rose-500/15 border border-rose-400/40 px-4 py-2 text-sm font-bold text-rose-200">
        Exit
      </button>
      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">{label}</span>
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-white/10 p-5 text-white text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-lg font-black">{title}</p>
          <button type="button" onClick={onClose} className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold">
            Done
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LobbyTiles({
  teamGame,
  powerName,
  powerIcon,
  openSpots,
  charName,
  charImage,
  onOpen,
}: {
  teamGame: boolean;
  powerName: string | null;
  powerIcon: string;
  openSpots: number;
  charName: string;
  charImage: string | null;
  onOpen: (t: "power" | "qr" | "character") => void;
}) {
  const tiles = [
    { key: "power" as const, label: "Perks", icon: <Icon name={powerIcon} size={30} />, sub: powerName ?? "None on" },
    {
      key: "qr" as const,
      label: teamGame ? "Invite" : "QR code",
      icon: <Icon name="qr" size={30} />,
      sub: teamGame ? (openSpots > 0 ? `${openSpots} open` : "Team full") : "Scan to join",
    },
    { key: "character" as const, label: "Character", icon: <Avatar imageUrl={charImage} size={38} />, sub: charName },
  ];
  return (
    <div className="w-full max-w-sm grid grid-cols-3 gap-2">
      {tiles.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onOpen(t.key)}
          className="aspect-square rounded-2xl bg-white/[0.07] border border-white/15 hover:border-amber-400/60 flex flex-col items-center justify-center gap-1 px-1 text-amber-300 active:scale-95 transition"
        >
          {t.icon}
          <span className="text-sm font-black text-white leading-tight">{t.label}</span>
          <span className="max-w-full truncate text-xs font-bold text-slate-300">{t.sub}</span>
        </button>
      ))}
    </div>
  );
}
