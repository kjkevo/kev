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
  DL_CHAR_POWERS,
  DL_COLS,
  DL_NAME,
  DL_PERKS,
  DL_PIECE,
  DL_ROWS,
  dlError,
  dlPerk,
  loadDlCreds,
  rememberDlPerk,
  rememberedDlPerk,
  saveDlCreds,
  type DlCreds,
  type DlState,
} from "@/lib/dropLine";
import { Icon } from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { EmoteCharacter } from "@/components/EmoteCharacter";
import { CharacterLocker } from "@/components/CharacterLocker";
import { JoinQRCode } from "@/components/JoinQRCode";
import { LevelChip } from "@/components/LevelChip";
import { GameProgress } from "@/components/GameProgress";

export default function DropLinePlayPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toUpperCase();
  const search = useSearchParams();
  const router = useRouter();
  const pageVenue = usePlayerVenue();
  const { avatars, byId } = useAvatars();
  const { avatarId, equip } = useEquippedAvatar(avatars);
  const { progress } = useProgress();

  const [creds, setCreds] = useState<DlCreds | null>(null);
  const [state, setState] = useState<DlState | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [tile, setTile] = useState<null | "perks" | "qr" | "character">(null);
  const [pickFor, setPickFor] = useState<null | "char" | "perk">(null);
  const [glow, setGlow] = useState<{ col: number; label: string } | null>(null);
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
    if (!code || joining.current) return;
    const saved = loadDlCreds(code);
    if (saved) {
      setCreds(saved);
      return;
    }
    if (!avatarId) return;
    joining.current = true;
    (async () => {
      const venue = search?.get("venue") ?? pageVenue ?? "main";
      const name = await ensurePlayName(venue);
      const team = search?.get("team");
      const { data, error } = await supabase.rpc("dl_join", {
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
        if (msg.includes("ALREADY_STARTED") || msg.includes("GAME_OVER") || msg.includes("TABLE_FULL")) {
          const next = await supabase.rpc("dl_open", { p_venue: venue, p_mode: team !== null && team !== undefined ? "team" : "solo" });
          const nextCode = next.data?.[0]?.o_code;
          if (nextCode && nextCode !== code) {
            router.replace(`/drop-line/play/${nextCode}`);
            return;
          }
        }
        setJoinError(dlError(error));
        return;
      }
      const c = { roomId: row.o_room_id, playerId: row.o_player_id, clientToken: row.o_client_token, seat: row.o_seat };
      saveDlCreds(code, c);
      setCreds(c);
      const want = rememberedDlPerk();
      if (want) {
        supabase
          .rpc("dl_set_power", { p_room_id: c.roomId, p_player_id: c.playerId, p_client_token: c.clientToken, p_power: want, p_device_key: deviceKey() })
          .then(({ error: e }) => {
            if (e?.message.includes("POWER_LOCKED")) rememberDlPerk(null);
          });
      }
    })();
  }, [code, avatarId, pageVenue, search, router]);

  const load = useCallback(async () => {
    if (!creds) return;
    const { data } = await supabase.rpc("dl_state", { p_room_id: creds.roomId });
    if (!data) return;
    const s = data as unknown as DlState;
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

  // What just happened, for everyone, 5 seconds each.
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
  const players = state?.players ?? [];
  const me = players.find((p) => p.id === creds?.playerId) ?? null;
  const now = Date.now() + offsetMs;
  const myTurn = !!room && room.phase === "playing" && !!me && room.turn_seat === me.seat;

  // The glow only lasts until the board changes.
  const boardKey = room?.board.join("") ?? "";
  useEffect(() => {
    setGlow(null);
  }, [boardKey]);

  const call = useCallback(
    async (fn: string, extra: Record<string, unknown> = {}) => {
      if (!creds) return null;
      const { data, error } = await supabase.rpc(fn as "dl_drop", {
        p_room_id: creds.roomId,
        p_player_id: creds.playerId,
        p_client_token: creds.clientToken,
        ...extra,
      } as never);
      setNote(error ? dlError(error) : null);
      load();
      return error ? null : ((data as unknown) ?? true);
    },
    [creds, load]
  );

  function showCol(data: unknown, label: string, none: string) {
    const col = (data as { col?: number | null } | null)?.col;
    if (typeof col === "number") setGlow({ col, label });
    else setNote(none);
  }

  async function tapColumn(col: number) {
    if (!room || !me) return;
    if (pickFor === "char") {
      setPickFor(null);
      await call("dl_use_char_power", { p_col: col });
      return;
    }
    if (pickFor === "perk") {
      setPickFor(null);
      await call("dl_use_power", { p_col: col });
      return;
    }
    if (!myTurn) {
      setNote("Wait for your turn");
      return;
    }
    await call("dl_drop", { p_col: col });
  }

  async function useCharPower() {
    const cp = me?.char_power ? DL_CHAR_POWERS[me.char_power] : null;
    if (!cp || !me) return;
    if (!myTurn) {
      setNote("Wait for your turn");
      return;
    }
    if (cp.pickCol) {
      setPickFor("char");
      setNote("Tap a column");
      return;
    }
    const data = await call("dl_use_char_power");
    if (data && me.char_power === "probe") showCol(data, "Their best move", "No big move for them");
    if (data && me.char_power === "riddle") showCol(data, "Win here!", "No win yet");
  }

  async function usePerk() {
    const pk = dlPerk(me?.power);
    if (!pk) return;
    if (!myTurn) {
      setNote("Wait for your turn");
      return;
    }
    if (pk.pickCol) {
      setPickFor("perk");
      setNote("Tap a column");
      return;
    }
    const data = await call("dl_use_power");
    if (data && pk.key === "hint") showCol(data, "Try here", "No hint");
  }

  async function pickPerk(key: string | null) {
    if (!creds) return;
    const { error } = await supabase.rpc("dl_set_power", {
      p_room_id: creds.roomId,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
      p_power: key,
      p_device_key: deviceKey(),
    });
    if (error) {
      setNote(dlError(error));
      return;
    }
    rememberDlPerk(key);
    load();
  }

  async function changeCharacter(id: string) {
    equip(id);
    if (!creds || !me) return;
    await supabase.rpc("dl_join", { p_code: code, p_nickname: me.nickname, p_avatar_id: id, p_device_key: deviceKey() });
    load();
  }

  async function playAgain() {
    const { data } = await supabase.rpc("dl_open", { p_venue: room?.venue ?? pageVenue ?? "main", p_mode: room?.mode ?? "solo" });
    const next = data?.[0]?.o_code;
    if (next) router.push(`/drop-line/play/${next}`);
  }

  async function leave() {
    if (creds) await supabase.rpc("dl_leave", { p_room_id: creds.roomId, p_player_id: creds.playerId, p_client_token: creds.clientToken });
    router.push("/drop-line");
  }

  const avatarsById = useMemo(() => byId, [byId]);

  if (joinError) {
    return (
      <Shell>
        <p className="text-2xl font-bold">{joinError}</p>
        <button onClick={() => router.push("/drop-line")} className="rounded-2xl bg-amber-400 text-black font-black text-xl px-8 py-4">
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
  const label = teamGame ? "Team Drop Line" : "Drop Line";
  const myChar = me.avatar_id ? avatarsById[me.avatar_id] : undefined;
  const charPower = me.char_power ? DL_CHAR_POWERS[me.char_power] : null;
  const perk = dlPerk(me.power);
  const level = progress?.level ?? 1;
  const myName = DL_NAME[me.color];

  // ---------- Results ----------
  if (room.phase === "final") {
    const tie = room.winner_color === null;
    const iWon = room.winner_color === me.color;
    const winners = players.filter((p) => p.color === room.winner_color);
    const star = iWon ? me : winners[0];
    const sc = star?.avatar_id ? avatarsById[star.avatar_id] : undefined;
    return (
      <Shell>
        <TopBar onExit={leave} label={label} />
        <h1 className="text-5xl font-black">
          {tie ? "It's a tie!" : iWon ? "You win!" : teamGame ? `${DL_NAME[room.winner_color ?? 1]} wins!` : `${star?.nickname ?? ""} wins!`}
        </h1>
        {!tie && star && <EmoteCharacter avatarId={star.avatar_id} emoji={sc?.emoji} imageUrl={sc?.imageUrl} size={190} play={null} />}
        {teamGame && !tie && <p className="text-2xl font-bold">{iWon ? "Your team won!" : "Their team won"}</p>}
        <MiniBoard board={room.board} />
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
    const partner = seated.find((p) => p.color === me.color && p.id !== me.id);
    return (
      <Shell>
        <TopBar onExit={leave} label={label} />
        <div className="w-full max-w-sm rounded-3xl bg-indigo-950/90 border border-white/15 p-4 flex items-center gap-4">
          <EmoteCharacter avatarId={me.avatar_id} emoji={myChar?.emoji} imageUrl={myChar?.imageUrl} size={110} play={null} />
          <div className="flex-1 min-w-0 flex flex-col items-center gap-2">
            <p className="text-xl font-black truncate max-w-full">{me.nickname}</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-sm font-bold">
                <span className={`w-3 h-3 rounded-full ${DL_PIECE[me.color]}`} />
                {teamGame ? `Team ${myName}` : myName}
              </span>
              <LevelChip />
            </div>
            <div className="flex items-center gap-1.5 text-amber-400">
              <Icon name="clock" size={22} />
              <span className="text-3xl font-black tabular-nums">{secs === null ? "--" : `0:${String(secs).padStart(2, "0")}`}</span>
            </div>
            <p className="text-base font-bold">{room.full ? "Starting soon!" : `${seated.length} of ${room.seats} here`}</p>
          </div>
        </div>
        {teamGame && (
          <p className="text-lg font-bold">
            Partner:{" "}
            {partner?.nickname ?? (
              <button onClick={() => setTile("qr")} className="underline text-amber-300">
                Invite one
              </button>
            )}
          </p>
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
            { key: "qr" as const, label: teamGame ? "Invite" : "QR code", icon: <Icon name="qr" size={30} />, sub: "Scan to join" },
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
        <p className="max-w-sm text-xl font-black">Get 4 in a row to win!</p>
        {note && <p className="text-lg font-bold text-amber-300">{note}</p>}
        {tile === "perks" && (
          <Sheet title="Perks" onClose={() => setTile(null)}>
            <p className="mb-2 text-lg font-bold">Pick 1</p>
            <div className="flex flex-col gap-2">
              {DL_PERKS.map((pk) => {
                const locked = level < pk.level;
                const on = me.power === pk.key;
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
              <JoinQRCode code={room.code} basePath="/drop-line/play" venue={room.venue ?? "main"} team={teamGame ? String(me.color - 1) : undefined} size={220} />
            </div>
          </Sheet>
        )}
        {tile === "character" && <CharacterLocker onClose={() => setTile(null)} onEquip={changeCharacter} />}
      </Shell>
    );
  }

  // ---------- Playing ----------
  const turnPlayer = players.find((p) => p.seat === room.turn_seat);
  const turnLeft = room.turn_started_at
    ? Math.max(0, Math.ceil(room.turn_limit - (now - Date.parse(room.turn_started_at)) / 1000))
    : room.turn_limit;
  const blockedForMe = room.blocked_color === me.color ? room.blocked_col : null;
  const shielded = new Set<number>([...(room.protected["1"] ?? []), ...(room.protected["2"] ?? [])]);
  const lastCells = new Set(Object.values(room.last_drop ?? {}).map((d) => d.row * DL_COLS + d.col));
  const order = [...players].sort((a, b) => a.seat - b.seat);

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white flex flex-col items-center px-3 pt-20 pb-6 gap-4">
      <TopBar onExit={leave} label={label} />

      {/* Everyone at the table, in turn order. */}
      <div className={`w-full max-w-md grid gap-2 ${order.length > 2 ? "grid-cols-4" : "grid-cols-2"}`}>
        {order.map((p) => {
          const a = p.avatar_id ? avatarsById[p.avatar_id] : undefined;
          const turn = p.seat === room.turn_seat;
          return (
            <div
              key={p.id}
              className={`rounded-2xl px-2 py-2 flex flex-col items-center gap-1 border ${turn ? "bg-amber-400/20 border-amber-400" : "bg-white/5 border-white/10"}`}
            >
              <Avatar emoji={a?.emoji} imageUrl={a?.imageUrl} size={40} />
              <span className="max-w-full truncate text-sm font-bold">{p.id === me.id ? "You" : p.nickname}</span>
              <span className={`w-5 h-5 rounded-full ${DL_PIECE[p.color]}`} />
            </div>
          );
        })}
      </div>

      <div className={`rounded-full px-5 py-2 text-2xl font-black ${myTurn ? "bg-amber-400 text-black animate-pulse" : "bg-white/10"}`}>
        {myTurn ? `Your turn! ${turnLeft}` : `${turnPlayer?.nickname ?? ""}'s turn`}
      </div>
      {pickFor && <p className="text-xl font-black text-emerald-300">Tap a column</p>}
      {glow && <p className="text-xl font-black text-violet-200">{glow.label}</p>}
      {note && !pickFor && <p className="text-lg font-bold text-amber-300">{note}</p>}

      {/* The board. Tap a column to drop your piece. */}
      <div className="w-full max-w-md">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {Array.from({ length: DL_COLS }, (_, c) => (
            <div key={c} className="h-6 flex items-center justify-center">
              {blockedForMe === c ? (
                <Icon name="x" size={20} className="text-rose-400" />
              ) : shielded.has(c) ? (
                <Icon name="check" size={20} className="text-sky-200" />
              ) : glow?.col === c ? (
                <Icon name="up" size={22} className="text-violet-200 rotate-180" />
              ) : null}
            </div>
          ))}
        </div>
        <div className="rounded-3xl bg-indigo-700 border-4 border-indigo-400/60 p-2 shadow-2xl">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: DL_COLS }, (_, c) => (
              <button
                key={c}
                onClick={() => tapColumn(c)}
                className={`flex flex-col gap-1 rounded-xl p-0.5 transition active:scale-95 ${
                  glow?.col === c ? "bg-violet-400/40" : pickFor ? "bg-emerald-400/20" : myTurn ? "hover:bg-white/10" : ""
                } ${blockedForMe === c ? "opacity-50" : ""}`}
              >
                {Array.from({ length: DL_ROWS }, (_, i) => {
                  const r = DL_ROWS - 1 - i;
                  const v = room.board[r * DL_COLS + c] ?? 0;
                  return (
                    <span
                      key={r}
                      className={`aspect-square w-full rounded-full ${v ? DL_PIECE[v] : "bg-indigo-950/80"} ${
                        v && lastCells.has(r * DL_COLS + c) ? "ring-2 ring-white" : ""
                      }`}
                    />
                  );
                })}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full max-w-md grid grid-cols-2 gap-2">
        {charPower && !me.char_used ? (
          <button
            onClick={useCharPower}
            className="rounded-2xl bg-violet-500/20 border border-violet-400/60 px-3 py-3 text-lg font-bold flex flex-col items-center justify-center active:scale-95"
          >
            <span className="flex items-center gap-1.5">
              <Icon name={charPower.icon} size={18} /> {charPower.name}
            </span>
            <span className="text-sm font-bold text-violet-200">{charPower.how}</span>
          </button>
        ) : (
          <span className="rounded-2xl bg-white/5 px-3 py-3 text-base text-slate-400 text-center">{charPower ? "Power used" : "No power"}</span>
        )}
        {perk && !me.power_used ? (
          <button
            onClick={usePerk}
            className="rounded-2xl bg-emerald-500/20 border border-emerald-400/60 px-3 py-3 text-lg font-bold flex flex-col items-center justify-center active:scale-95"
          >
            <span className="flex items-center gap-1.5">
              <Icon name={perk.icon} size={18} /> {perk.name}
            </span>
            <span className="text-sm font-bold text-emerald-200">{perk.how}</span>
          </button>
        ) : (
          <span className="rounded-2xl bg-white/5 px-3 py-3 text-base text-slate-400 text-center">{perk ? "Perk used" : "No perk"}</span>
        )}
      </div>
      {pickFor && (
        <button onClick={() => setPickFor(null)} className="text-lg font-bold text-slate-300 underline">
          Cancel
        </button>
      )}

      {toasts.length > 0 && (
        <div className="fixed right-2 bottom-24 z-40 flex flex-col items-end gap-1.5 pointer-events-none">
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

function MiniBoard({ board }: { board: number[] }) {
  return (
    <div className="rounded-2xl bg-indigo-700 border-2 border-indigo-400/60 p-1.5 grid grid-cols-7 gap-0.5 w-48">
      {Array.from({ length: DL_ROWS * DL_COLS }, (_, i) => {
        const r = DL_ROWS - 1 - Math.floor(i / DL_COLS);
        const c = i % DL_COLS;
        const v = board[r * DL_COLS + c] ?? 0;
        return <span key={i} className={`aspect-square rounded-full ${v ? DL_PIECE[v] : "bg-indigo-950/80"}`} />;
      })}
    </div>
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
