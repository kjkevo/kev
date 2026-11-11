"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Icon } from "@/components/Icon";
import { deviceKey } from "@/lib/device";
import { PERK_ERRORS, perkInfo, rememberPerk, rememberedPerk } from "@/lib/perks";
import type { PlayerCredentials, Player } from "@/lib/types";

type PerkRow = { key: string; name: string; level: number; unlocked: boolean };

function errorCode(e: unknown) {
  const msg = (e as { message?: string })?.message ?? String(e);
  return Object.keys(PERK_ERRORS).find((k) => msg.includes(k)) ?? null;
}

/**
 * Lobby "Perks": every perk on a carousel. Unlocked ones can be equipped
 * (one per game, on top of your character's power); locked ones show the
 * level that unlocks them. Not for sale: only leveling up unlocks them.
 */
export function PerkPicker({ roomId, creds, me }: { roomId: string; creds: PlayerCredentials; me: Player | undefined }) {
  const [perks, setPerks] = useState<PerkRow[] | null>(null);
  const [i, setI] = useState(0);
  const [equipped, setEquipped] = useState<string | null>(me?.perk ?? null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const touchX = useRef<number | null>(null);

  useEffect(() => setEquipped(me?.perk ?? null), [me?.perk]);

  useEffect(() => {
    supabase.rpc("list_perks", { p_device_key: deviceKey() }).then(({ data }) => {
      if (!data) return;
      const rows = data.map((r) => ({ key: r.o_key, name: r.o_name, level: r.o_unlock_level, unlocked: r.o_unlocked }));
      setPerks(rows);
      // Open on the equipped perk, else the first unlocked one.
      const start = rows.findIndex((r) => r.key === (me?.perk ?? rememberedPerk()));
      setI(Math.max(0, start));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!perks || perks.length === 0) return null;
  const row = perks[Math.min(i, perks.length - 1)];
  const info = perkInfo(row.key);
  const isOn = equipped === row.key;
  const go = (d: number) => setI((n) => (n + d + perks.length) % perks.length);

  async function toggle() {
    const next = isOn ? null : row.key;
    setBusy(true);
    setNote(null);
    const { error } = await supabase.rpc("set_player_perk", {
      p_room_id: roomId,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
      p_perk: next,
      p_device_key: deviceKey(),
    });
    setBusy(false);
    if (error) {
      setNote(error.message.includes("PERK_LOCKED") ? `Unlocks at Level ${row.level}` : "Couldn't change your perk. Try again.");
      return;
    }
    setEquipped(next);
    rememberPerk(next);
  }

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="font-black">Perks</p>
        <p className="text-xs text-slate-400">
          {equipped ? perkInfo(equipped)?.name ?? equipped : "Pick 1"}
        </p>
      </div>
      <div
        className="flex items-center gap-2"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
      >
        <button type="button" onClick={() => go(-1)} aria-label="Previous perk" className="w-9 h-9 shrink-0 rounded-full bg-white/10 text-xl font-black active:scale-90">
          ‹
        </button>
        <div
          key={row.key}
          className={`flex-1 min-w-0 rounded-xl px-3 py-3 flex flex-col items-center gap-1 text-center animate-[fade-in_0.2s_ease-out] ${
            isOn ? "bg-emerald-400/15 border border-emerald-400/60" : row.unlocked ? "bg-white/5 border border-white/10" : "bg-black/30 border border-white/5"
          }`}
        >
          <span className={row.unlocked ? "text-amber-300" : "text-slate-500"}>
            <Icon name={info?.icon ?? "bolt"} size={40} />
          </span>
          <span className={`font-black ${row.unlocked ? "" : "text-slate-400"}`}>{row.name}</span>
          <span className="text-lg text-white leading-snug">{info?.how}</span>
          {row.unlocked ? (
            <button
              type="button"
              onClick={toggle}
              disabled={busy}
              className={`mt-1 rounded-full px-5 py-1.5 text-sm font-black active:scale-95 transition disabled:opacity-60 ${
                isOn ? "bg-emerald-400 text-black" : "bg-amber-400 text-black"
              }`}
            >
              {isOn ? "Equipped" : "Equip"}
            </button>
          ) : (
            <span className="mt-1 rounded-full bg-white/10 px-4 py-1.5 text-sm font-bold text-slate-300">Unlocks at Level {row.level}</span>
          )}
        </div>
        <button type="button" onClick={() => go(1)} aria-label="Next perk" className="w-9 h-9 shrink-0 rounded-full bg-white/10 text-xl font-black active:scale-90">
          ›
        </button>
      </div>
      <div className="flex justify-center gap-1.5 mt-2" aria-hidden="true">
        {perks.map((p, n) => (
          <span
            key={p.key}
            className={`h-1.5 rounded-full transition-all ${n === i ? "w-4 bg-amber-400" : p.key === equipped ? "w-1.5 bg-emerald-400" : "w-1.5 bg-white/25"}`}
          />
        ))}
      </div>
      {note && <p className="mt-1 text-center text-xs font-bold text-rose-300">{note}</p>}
    </div>
  );
}

/**
 * Equip the perk this phone used last game as soon as it joins a new one
 * (so it carries over even when the lobby is skipped, e.g. joining a solo
 * game mid-way). A perk no longer unlocked is forgotten.
 */
export function useCarryPerk(roomId: string | undefined, creds: PlayerCredentials | null, me: Player | undefined) {
  const tried = useRef<string | null>(null);
  useEffect(() => {
    if (!roomId || !creds || !me || tried.current === roomId) return;
    tried.current = roomId;
    const want = rememberedPerk();
    if (!want || me.perk === want || me.perk) return;
    supabase
      .rpc("set_player_perk", {
        p_room_id: roomId,
        p_player_id: creds.playerId,
        p_client_token: creds.clientToken,
        p_perk: want,
        p_device_key: deviceKey(),
      })
      .then(({ error }) => {
        if (error?.message.includes("PERK_LOCKED") || error?.message.includes("PERK_NOT_FOUND")) rememberPerk(null);
      });
  }, [roomId, creds, me]);
}

/**
 * The equipped perk on the question screen: a button for perks you tap
 * (Time Freeze, Comeback Kid, All In), once per game. Automatic perks just
 * show as a small "on" tag.
 */
export function PerkButton({
  roomId,
  questionId,
  creds,
  perk,
}: {
  roomId: string;
  questionId: string;
  creds: PlayerCredentials;
  perk: string | null | undefined;
}) {
  const [used, setUsed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const info = perkInfo(perk);

  useEffect(() => {
    if (!info) return;
    supabase
      .from("trivia_perks")
      .select("id")
      .eq("room_id", roomId)
      .eq("player_id", creds.playerId)
      .limit(1)
      .then(({ data }) => setUsed((data?.length ?? 0) > 0));
  }, [roomId, creds.playerId, info, questionId]);

  useEffect(() => setNote(null), [questionId]);

  if (!info || used === null) return null;
  if (!info.active) {
    return (
      <p className="self-center rounded-full bg-emerald-400/10 border border-emerald-400/30 px-3 py-1 text-xs font-bold text-emerald-200">
        {info.name} {used ? "used" : "is on"}
      </p>
    );
  }
  if (used) {
    return <p className="self-center text-xs font-bold text-slate-500">{info.name} used</p>;
  }

  async function use() {
    setBusy(true);
    setNote(null);
    const { error } = await supabase.rpc("use_perk", {
      p_room_id: roomId,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
      p_question_id: questionId,
    });
    setBusy(false);
    if (error) {
      const code = errorCode(error);
      setNote(code === "TOO_EARLY" && info?.when ? info.when : code ? PERK_ERRORS[code] : "Couldn't use it. Try again.");
      return;
    }
    setUsed(true);
  }

  return (
    <div className="self-center flex flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={use}
        disabled={busy}
        className="rounded-full bg-emerald-500/20 border border-emerald-400/60 px-4 py-2 text-sm font-bold text-emerald-100 active:scale-95 transition disabled:opacity-60"
      >
        Use {info.name}
      </button>
      {note && <p className="text-xs font-bold text-amber-300">{note}</p>}
    </div>
  );
}
