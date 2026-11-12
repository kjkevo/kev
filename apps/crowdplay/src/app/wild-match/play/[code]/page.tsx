"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { deviceKey } from "@/lib/device";
import { usePlayerVenue, rememberPlayerVenue } from "@/lib/venue";
import { useAvatars, useEquippedAvatar } from "@/hooks/useAvatars";
import { useProgress } from "@/lib/progress";
import { ensurePlayName } from "@/lib/slimpseBingo";
import {
  WM_BG,
  WM_CHAR_POWERS,
  WM_COLORS,
  WM_PERKS,
  WM_TURN_SECONDS,
  loadWmCreds,
  rememberWmPerk,
  rememberedWmPerk,
  saveWmCreds,
  wmColor,
  wmError,
  wmLabel,
  wmPerk,
  wmPlayable,
  type WmColor,
  type WmCreds,
  type WmState,
} from "@/lib/wildMatch";
import { Icon } from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { EmoteCharacter } from "@/components/EmoteCharacter";
import { CharacterLocker } from "@/components/CharacterLocker";
import { JoinQRCode } from "@/components/JoinQRCode";
import { LevelChip } from "@/components/LevelChip";
import { GameProgress } from "@/components/GameProgress";

/** One card, big and simple: its color and what's on it. */
function Card({ c, size = "md", dim = false, lift = false, onClick }: { c: number; size?: "sm" | "md" | "lg"; dim?: boolean; lift?: boolean; onClick?: () => void }) {
  const color = wmColor(c);
  const bg = color ? WM_BG[color] : "bg-gradient-to-br from-rose-500 via-amber-400 to-sky-500";
  const dims = size === "lg" ? "w-20 h-28 text-4xl" : size === "sm" ? "w-10 h-14 text-base" : "w-14 h-20 text-2xl";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`${dims} ${bg} shrink-0 rounded-2xl border-4 border-white/90 text-white font-black flex items-center justify-center shadow-lg transition ${
        dim ? "opacity-40" : ""
      } ${lift ? "-translate-y-3 ring-4 ring-white" : ""} active:scale-95`}
    >
      <span
        className={`drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)] leading-none ${
          wmLabel(c).length > 2 ? (size === "lg" ? "text-2xl" : size === "sm" ? "text-[10px]" : "text-base") : ""
        }`}
      >
        {wmLabel(c)}
      </span>
    </button>
  );
}

export default function WildMatchPlayPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toUpperCase();
  const search = useSearchParams();
  const router = useRouter();
  const pageVenue = usePlayerVenue();
  const { avatars, byId } = useAvatars();
  const { avatarId, equip } = useEquippedAvatar(avatars);
  const { progress } = useProgress();

  const [creds, setCreds] = useState<WmCreds | null>(null);
  const [state, setState] = useState<WmState | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [tile, setTile] = useState<null | "perks" | "qr" | "character">(null);
  const [colorFor, setColorFor] = useState<null | { kind: "card"; card: number } | { kind: "perk" }>(null);
  const [pickCard, setPickCard] = useState(false);
  const [peek, setPeek] = useState<{ name: string; hand: number[] } | null>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const lastLog = useRef<number | null>(null);
  const [, setTick] = useState(0);
  const joining = useRef(false);

  useEffect(() => {
    const v = search?.get("venue");
    if (v) rememberPlayerVenue(v);
  }, [search]);

  // Sit down on arrival: name and character filled in, so it's one tap from a QR code.
  useEffect(() => {
    if (!code || !avatarId || joining.current) return;
    const saved = loadWmCreds(code);
    if (saved) {
      setCreds(saved);
      return;
    }
    joining.current = true;
    (async () => {
      const venue = search?.get("venue") ?? pageVenue ?? "main";
      const name = await ensurePlayName(venue);
      const team = search?.get("team");
      const { data, error } = await supabase.rpc("wm_join", {
        p_code: code,
        p_nickname: name,
        p_avatar_id: avatarId,
        p_device_key: deviceKey(),
        p_team: team === null || team === undefined ? undefined : Number(team),
      });
      const row = data?.[0];
      if (error || !row) {
        joining.current = false;
        const msg = error?.message ?? "";
        const moved = msg.match(/MOVED_TO_([A-Z0-9]+)/);
        if (moved) {
          router.replace(`/wild-match/play/${moved[1]}`);
          return;
        }
        if (msg.includes("ALREADY_STARTED") || msg.includes("GAME_OVER") || msg.includes("TABLE_FULL")) {
          const next = await supabase.rpc("wm_open", { p_venue: venue, p_mode: team !== null && team !== undefined ? "team" : "solo" });
          const nextCode = next.data?.[0]?.o_code;
          if (nextCode && nextCode !== code) {
            router.replace(`/wild-match/play/${nextCode}`);
            return;
          }
        }
        setJoinError(wmError(error));
        return;
      }
      const c = { roomId: row.o_room_id, playerId: row.o_player_id, clientToken: row.o_client_token, seat: row.o_seat };
      saveWmCreds(code, c);
      setCreds(c);
      const want = rememberedWmPerk();
      if (want) {
        supabase
          .rpc("wm_set_power", { p_room_id: c.roomId, p_player_id: c.playerId, p_client_token: c.clientToken, p_power: want, p_device_key: deviceKey() })
          .then(({ error: e }) => {
            if (e?.message.includes("POWER_LOCKED")) rememberWmPerk(null);
          });
      }
    })();
  }, [code, avatarId, pageVenue, search, router]);

  const load = useCallback(async () => {
    if (!creds) return;
    const { data } = await supabase.rpc("wm_state", { p_room_id: creds.roomId, p_player_id: creds.playerId, p_client_token: creds.clientToken });
    if (!data) return;
    const s = data as unknown as WmState;
    if (s.room?.now) setOffsetMs(Date.parse(s.room.now) - Date.now());
    setState(s);
  }, [creds]);
  useEffect(() => {
    if (!creds) return;
    load();
    const t = setInterval(load, state?.room?.phase === "final" ? 4000 : 1000);
    return () => clearInterval(t);
  }, [creds, load, state?.room?.phase]);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, []);

  // What just happened, for everyone ("Kev played Red +2"), 5 seconds each.
  useEffect(() => {
    const log = state?.room?.log ?? [];
    if (log.length === 0) return;
    const newest = log[log.length - 1].id;
    if (lastLog.current === null) {
      lastLog.current = newest;
      return;
    }
    const fresh = log.filter((e) => e.id > (lastLog.current ?? 0));
    lastLog.current = newest;
    if (fresh.length === 0) return;
    setToasts((prev) => [...prev, ...fresh].slice(-3));
    const ids = fresh.map((e) => e.id);
    setTimeout(() => setToasts((prev) => prev.filter((t) => !ids.includes(t.id))), 5000);
  }, [state?.room?.log]);

  const room = state?.room ?? null;
  const me = state?.me ?? null;
  const players = state?.players ?? [];
  const mine = players.find((p) => p.id === creds?.playerId);
  const now = Date.now() + offsetMs;
  const myTurn = !!room && room.phase === "playing" && !!me && room.turn_seat === me.seat;

  const call = useCallback(
    async (fn: string, extra: Record<string, unknown> = {}) => {
      if (!creds) return null;
      const { data, error } = await supabase.rpc(fn as "wm_draw", {
        p_room_id: creds.roomId,
        p_player_id: creds.playerId,
        p_client_token: creds.clientToken,
        ...extra,
      } as never);
      setNote(error ? wmError(error) : null);
      load();
      return error ? null : (data as unknown) ?? true;
    },
    [creds, load]
  );

  async function tapCard(c: number) {
    if (!room || !me) return;
    if (pickCard) {
      setPickCard(false);
      await call("wm_use_char_power", { p_card: c });
      return;
    }
    if (!myTurn) {
      setNote("Wait for your turn");
      return;
    }
    if (!wmPlayable(c, room.top, room.color, me.free_play)) {
      setNote("That card doesn't match");
      return;
    }
    if (c >= 100) {
      setColorFor({ kind: "card", card: c });
      return;
    }
    await call("wm_play", { p_card: c });
  }

  async function chooseColor(color: WmColor) {
    const f = colorFor;
    setColorFor(null);
    if (!f) return;
    if (f.kind === "card") await call("wm_play", { p_card: f.card, p_color: color });
    else await call("wm_use_power", { p_color: color });
  }

  async function useCharPower() {
    const cp = mine?.char_power ? WM_CHAR_POWERS[mine.char_power] : null;
    if (!cp) return;
    if (!myTurn) {
      setNote("Wait for your turn");
      return;
    }
    if (cp.pickCard) {
      setPickCard(true);
      setNote("Tap a card to toss");
      return;
    }
    const data = (await call("wm_use_char_power")) as { peek_name?: string; peek_hand?: number[] } | null;
    if (data && typeof data === "object" && data.peek_hand) {
      setPeek({ name: data.peek_name ?? "Next player", hand: data.peek_hand });
      setTimeout(() => setPeek(null), 10000);
    }
  }

  async function usePerk() {
    if (!mine?.power) return;
    if (!myTurn) {
      setNote("Wait for your turn");
      return;
    }
    if (mine.power === "color") {
      setColorFor({ kind: "perk" });
      return;
    }
    await call("wm_use_power");
  }

  async function pickPerk(key: string | null) {
    if (!creds) return;
    const { error } = await supabase.rpc("wm_set_power", {
      p_room_id: creds.roomId,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
      p_power: key,
      p_device_key: deviceKey(),
    });
    if (error) {
      setNote(wmError(error));
      return;
    }
    rememberWmPerk(key);
    load();
  }

  async function changeCharacter(id: string) {
    equip(id);
    if (!creds || !mine) return;
    await supabase.rpc("wm_join", { p_code: code, p_nickname: mine.nickname, p_avatar_id: id, p_device_key: deviceKey() });
    load();
  }

  async function playAgain() {
    if (!room) return;
    const { data } = await supabase.rpc("wm_again", { p_room_id: room.id });
    const next = data?.[0]?.o_code;
    if (next) router.push(`/wild-match/play/${next}`);
  }

  async function startNow() {
    if (!creds) return;
    await supabase.rpc("wm_start_now", { p_room_id: creds.roomId, p_player_id: creds.playerId, p_client_token: creds.clientToken });
    load();
  }


  async function leave() {
    if (creds) await supabase.rpc("wm_leave", { p_room_id: creds.roomId, p_player_id: creds.playerId, p_client_token: creds.clientToken });
    router.push("/wild-match");
  }

  const avatarsById = useMemo(() => byId, [byId]);

  if (joinError) {
    return (
      <Shell>
        <p className="text-2xl font-bold">{joinError}</p>
        <button onClick={() => router.push("/wild-match")} className="rounded-2xl bg-amber-400 text-black font-black text-xl px-8 py-4">
          Back
        </button>
      </Shell>
    );
  }
  if (!room || !creds || !me) {
    return (
      <Shell>
        <p className="text-2xl text-slate-200">Finding your seat…</p>
      </Shell>
    );
  }

  const teamGame = room.mode === "team";
  const myChar = mine?.avatar_id ? avatarsById[mine.avatar_id] : undefined;
  const charPower = mine?.char_power ? WM_CHAR_POWERS[mine.char_power] : null;
  const perk = wmPerk(mine?.power);
  const level = progress?.level ?? 1;
  const others = [1, 2, 3].map((k) => players.find((p) => p.seat === (me.seat + k) % 4)).filter(Boolean) as typeof players;

  // ---------- Results ----------
  if (room.phase === "final") {
    const winner = players.find((p) => p.seat === room.winner_seat);
    const iWon = teamGame ? room.winner_team === me.team : room.winner_seat === me.seat;
    const wc = winner?.avatar_id ? avatarsById[winner.avatar_id] : undefined;
    return (
      <Shell>
        <TopBar onExit={leave} label={teamGame ? "Team Wild Match" : "Wild Match"} />
        <h1 className="text-5xl font-black">{winner ? (iWon ? "You win!" : `${winner.nickname} wins!`) : "Game over"}</h1>
        {winner && <EmoteCharacter avatarId={winner.avatar_id} emoji={wc?.emoji} imageUrl={wc?.imageUrl} size={190} play={null} />}
        {teamGame && winner && <p className="text-2xl font-bold">{iWon ? "Your team won!" : "Their team won"}</p>}
        <div className="w-full max-w-xs">
          <GameProgress roomId={room.id} avatars={avatarsById} />
        </div>
        <button onClick={playAgain} className="w-full max-w-xs rounded-2xl bg-amber-400 text-black font-black text-2xl py-4 active:scale-95 transition">
          Play again
        </button>
        <button onClick={() => router.push("/")} className="text-lg text-slate-300 underline">
          Back to Games
        </button>
      </Shell>
    );
  }

  // ---------- Lobby ----------
  if (room.phase === "lobby") {
    const secs = room.starts_at ? Math.max(0, Math.ceil((Date.parse(room.starts_at) - now) / 1000)) : null;
    const seated = players.filter((p) => !p.left);
    const myTeamMates = seated.filter((p) => p.team === me.team && p.id !== me.id);
    return (
      <Shell>
        <TopBar onExit={leave} label={teamGame ? "Team Wild Match" : "Wild Match"} />
        <div className="w-full max-w-sm rounded-3xl bg-indigo-950/90 border border-white/15 p-4 flex items-center gap-4">
          <EmoteCharacter avatarId={mine?.avatar_id} emoji={myChar?.emoji} imageUrl={myChar?.imageUrl} size={110} play={null} />
          <div className="flex-1 min-w-0 flex flex-col items-center gap-2">
            <p className="text-xl font-black truncate max-w-full">{mine?.nickname}</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-sm font-bold">
                <Icon name={teamGame ? "users" : "user"} size={14} />
                {teamGame ? `Team ${me.team === 0 ? "A" : "B"}` : "Solo"}
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
            <p className="text-base font-bold">{room.full ? "Starting soon!" : `${seated.length} of 4 here`}</p>
          </div>
        </div>
        {teamGame && (
          <p className="text-lg font-bold">
            Partner: {myTeamMates[0]?.nickname ?? <button onClick={() => setTile("qr")} className="underline text-amber-300">Invite one</button>}
          </p>
        )}
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
              <span className="block text-base">{charPower.how}</span>
            </span>
          </div>
        )}
        <div className="w-full max-w-sm grid grid-cols-3 gap-2">
          {[
            { key: "perks" as const, label: "Perks", icon: <Icon name={perk?.icon ?? "bolt"} size={30} />, sub: perk?.name ?? "None on" },
            { key: "qr" as const, label: teamGame || room.private ? "Invite" : "QR code", icon: <Icon name="qr" size={30} />, sub: "Scan to join" },
            { key: "character" as const, label: "Character", icon: <Avatar imageUrl={myChar?.imageUrl} size={38} />, sub: myChar?.name ?? "Pick one" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTile(t.key)}
              className="aspect-square rounded-2xl bg-white/[0.07] border border-white/15 flex flex-col items-center justify-center gap-1 px-1 text-amber-300 active:scale-95 transition"
            >
              {t.icon}
              <span className="text-sm font-black text-white">{t.label}</span>
              <span className="max-w-full truncate text-xs font-bold text-slate-300">{t.sub}</span>
            </button>
          ))}
        </div>
        <p className="max-w-sm text-xl font-black">Match the color or number. First to play all your cards wins!</p>
        {note && <p className="text-lg font-bold text-amber-300">{note}</p>}
        {tile === "perks" && (
          <Sheet title="Perks" onClose={() => setTile(null)}>
            <p className="mb-2 text-lg font-bold">Pick 1</p>
            <div className="flex flex-col gap-2">
              {WM_PERKS.map((pk) => {
                const locked = level < pk.level;
                const on = mine?.power === pk.key;
                return (
                  <button
                    key={pk.key}
                    disabled={locked}
                    onClick={() => pickPerk(on ? null : pk.key)}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left disabled:opacity-50 ${on ? "bg-emerald-400/15 border-emerald-400/60" : "bg-white/5 border-white/10"}`}
                  >
                    <Icon name={pk.icon} size={30} className="text-amber-300" />
                    <span className="flex-1">
                      <span className="block text-lg font-black">{pk.name}</span>
                      <span className="block text-base">{pk.how}</span>
                    </span>
                    <span className="text-sm font-bold">{locked ? `Level ${pk.level}` : on ? "On" : "Pick"}</span>
                  </button>
                );
              })}
            </div>
          </Sheet>
        )}
        {tile === "qr" && (
          <Sheet title={teamGame ? "Invite your partner" : "Scan to join"} onClose={() => setTile(null)}>
            <div className="flex flex-col items-center gap-2">
              <JoinQRCode code={room.code} basePath="/wild-match/play" venue={room.venue ?? "main"} team={teamGame ? String(me.team) : undefined} size={220} />
            </div>
          </Sheet>
        )}
        {tile === "character" && <CharacterLocker onClose={() => setTile(null)} onEquip={changeCharacter} />}
      </Shell>
    );
  }

  // ---------- Playing ----------
  const turnPlayer = players.find((p) => p.seat === room.turn_seat);
  const turnLeft = room.turn_started_at ? Math.max(0, Math.ceil(WM_TURN_SECONDS - (now - Date.parse(room.turn_started_at)) / 1000)) : WM_TURN_SECONDS;
  const hand = [...me.hand].sort((a, b) => (wmColor(a) ?? "z").localeCompare(wmColor(b) ?? "z") || a - b);

  return (
    <main className="relative min-h-[100svh] bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white flex flex-col items-center px-3 pt-16 pb-4 gap-2.5">
      <TopBar onExit={leave} label={teamGame ? "Team Wild Match" : "Wild Match"} />

      {/* The other three players: whose turn, how many cards. */}
      <div className="w-full max-w-md grid grid-cols-3 gap-2">
        {others.map((p) => {
          const a = p.avatar_id ? avatarsById[p.avatar_id] : undefined;
          const turn = p.seat === room.turn_seat;
          const partner = teamGame && p.team === me.team;
          return (
            <div
              key={p.id}
              className={`rounded-2xl px-1.5 py-1.5 flex flex-col items-center gap-0.5 border ${
                turn ? "bg-amber-400/20 border-amber-400" : partner ? "bg-sky-500/10 border-sky-400/50" : "bg-white/5 border-white/10"
              }`}
            >
              <span className="flex items-center gap-1.5 max-w-full">
                <Avatar emoji={a?.emoji} imageUrl={a?.imageUrl} size={28} />
                <span className="text-lg font-black">{p.cards}</span>
              </span>
              <span className="max-w-full truncate text-sm font-bold">{partner ? "Partner" : p.nickname}</span>
            </div>
          );
        })}
      </div>

      {/* The pile and the deck. */}
      <div className="flex items-center gap-5">
        <div className="flex flex-col items-center gap-1">
          {room.top !== null && <Card c={room.top} size="lg" />}
          <span className={`rounded-full px-3 py-0.5 text-base font-black text-black capitalize ${room.color ? WM_BG[room.color] : "bg-white"}`}>
            {room.color}
          </span>
        </div>
        <button
          onClick={() => (myTurn ? call("wm_draw") : setNote("Wait for your turn"))}
          className={`w-20 h-28 rounded-2xl border-4 border-white/70 bg-slate-800 flex flex-col items-center justify-center gap-1 active:scale-95 transition ${
            myTurn ? "ring-4 ring-amber-400" : ""
          }`}
        >
          <Icon name="cards" size={28} />
          <span className="text-xl font-black">Draw</span>
        </button>
      </div>

      <div className={`rounded-full px-5 py-1.5 text-xl font-black ${myTurn ? "bg-amber-400 text-black animate-pulse" : "bg-white/10"}`}>
        {myTurn ? `Your turn! ${turnLeft}` : `${turnPlayer?.nickname ?? ""}'s turn`}
      </div>
      {me.free_play && <p className="text-lg font-bold text-emerald-300">Play any card!</p>}
      {mine?.shield && <p className="text-lg font-bold text-sky-200">Shield is up</p>}
      {note && <p className="text-lg font-bold text-amber-300">{note}</p>}
      {peek && (
        <div className="rounded-2xl bg-violet-500/20 border border-violet-400/50 px-3 py-2 flex flex-col items-center gap-1">
          <span className="text-base font-bold">{peek.name}&apos;s cards</span>
          <div className="flex flex-wrap justify-center gap-1">
            {peek.hand.map((c) => (
              <Card key={c} c={c} size="sm" />
            ))}
          </div>
        </div>
      )}

      {/* Your hand. Cards you can play are bright. */}
      <div className="w-full max-w-md pt-2">
        <div className="flex flex-wrap justify-center gap-2 gap-y-3 px-1">
          {hand.map((c) => {
            const ok = myTurn && wmPlayable(c, room.top, room.color, me.free_play);
            return <Card key={c} c={c} dim={myTurn && !ok && !pickCard} lift={ok} onClick={() => tapCard(c)} />;
          })}
        </div>
      </div>

      <div className="w-full max-w-md grid grid-cols-2 gap-2">
        {charPower && !mine?.char_used ? (
          <button
            onClick={useCharPower}
            className="rounded-2xl bg-violet-500/20 border border-violet-400/60 px-3 py-2.5 text-lg font-bold flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Icon name={charPower.icon} size={18} /> {charPower.name}
          </button>
        ) : (
          <span className="rounded-2xl bg-white/5 px-3 py-2.5 text-base text-slate-400 text-center">{charPower ? "Power used" : "No power"}</span>
        )}
        {perk && !mine?.power_used ? (
          <button
            onClick={usePerk}
            className="rounded-2xl bg-emerald-500/20 border border-emerald-400/60 px-3 py-2.5 text-lg font-bold flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Icon name={perk.icon} size={18} /> {perk.name}
          </button>
        ) : (
          <span className="rounded-2xl bg-white/5 px-3 py-2.5 text-base text-slate-400 text-center">{perk ? "Perk used" : "No perk"}</span>
        )}
      </div>

      {colorFor && (
        <Sheet title="Pick a color" onClose={() => setColorFor(null)}>
          <div className="grid grid-cols-2 gap-3">
            {WM_COLORS.map((c) => (
              <button key={c} onClick={() => chooseColor(c)} className={`${WM_BG[c]} rounded-2xl py-6 text-2xl font-black capitalize text-white active:scale-95`}>
                {c}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {toasts.length > 0 && (
        <div className="fixed right-2 top-16 z-40 flex flex-col items-end gap-1.5 pointer-events-none">
          {toasts.map((t) => (
            <p key={t.id} className="toast-slide-in max-w-[70vw] truncate rounded-full bg-slate-800/95 border border-white/20 px-3 py-1.5 text-sm font-bold shadow-lg">
              {t.text}
            </p>
          ))}
        </div>
      )}
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white px-4 py-20 text-center">
      {children}
    </main>
  );
}

function TopBar({ onExit, label }: { onExit: () => void; label: string }) {
  return (
    <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
      <button onClick={onExit} className="rounded-full bg-rose-500/15 border border-rose-400/40 px-4 py-2 text-base font-bold text-rose-200">
        Exit
      </button>
      <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold">{label}</span>
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-white/10 p-5 text-white text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xl font-black">{title}</p>
          <button onClick={onClose} className="rounded-full bg-white/10 px-3 py-1 text-base font-bold">
            Done
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
