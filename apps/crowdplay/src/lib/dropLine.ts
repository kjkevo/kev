"use client";

import type { IconName } from "@/components/Icon";

/** Drop Line (dl_* tables, migration 0116). Board index = row * 7 + col (row 0 is the bottom). */
export type DlRoom = {
  id: string;
  code: string;
  mode: "solo" | "team";
  phase: "lobby" | "playing" | "final";
  starts_at: string | null;
  board: number[];
  turn_seat: number;
  turn_started_at: string | null;
  turn_limit: number;
  winner_color: number | null;
  blocked_col: number | null;
  blocked_color: number | null;
  protected: Record<string, number[]>;
  last_drop: Record<string, { row: number; col: number }>;
  log: { id: number; text: string }[];
  now: string;
  venue: string | null;
  seats: number;
  full: boolean;
};
export type DlPlayer = {
  id: string;
  seat: number;
  color: number;
  nickname: string;
  avatar_id: string | null;
  is_bot: boolean;
  char_power: string | null;
  char_used: boolean;
  power: string | null;
  power_used: boolean;
  left: boolean;
};
export type DlState = { room: DlRoom | null; players: DlPlayer[] };
export type DlCreds = { roomId: string; playerId: string; clientToken: string; seat: number };

export const DL_COLS = 7;
export const DL_ROWS = 6;
/** 1 Gold, 2 Blue, 3 a block. */
export const DL_NAME: Record<number, string> = { 1: "Gold", 2: "Blue" };
export const DL_PIECE: Record<number, string> = {
  1: "bg-amber-400 shadow-[inset_0_-4px_0_rgba(0,0,0,0.25)]",
  2: "bg-sky-400 shadow-[inset_0_-4px_0_rgba(0,0,0,0.25)]",
  3: "bg-slate-500 shadow-[inset_0_-4px_0_rgba(0,0,0,0.3)]",
};

/** Each character's own power in Drop Line (matches dl_char_power). */
export const DL_CHAR_POWERS: Record<string, { name: string; icon: IconName; how: string; pickCol?: boolean }> = {
  trailblaze: { name: "Trailblaze", icon: "bolt", how: "Knock off a top piece", pickCol: true },
  shield: { name: "Crystal Shield", icon: "check", how: "Protect a column", pickCol: true },
  probe: { name: "Mind Probe", icon: "eye", how: "See their best move" },
  patience: { name: "Patience", icon: "clock", how: "+20 seconds" },
  bloom: { name: "Bloom", icon: "up", how: "Drop a block", pickCol: true },
  riddle: { name: "Riddle Sight", icon: "star", how: "Show your winning move" },
  rift: { name: "Void Rift", icon: "target", how: "Remove their piece" },
  overclock: { name: "Overclock", icon: "bolt", how: "Take 2 turns" },
  secondwind: { name: "Second Wind", icon: "swap", how: "Undo your last drop" },
};

/** Drop Line perks: earned by leveling up, bring one per game. */
export const DL_PERKS: { key: string; name: string; icon: IconName; how: string; level: number; pickCol?: boolean }[] = [
  { key: "time", name: "Extra Time", icon: "clock", how: "+15 seconds", level: 3 },
  { key: "hint", name: "Hint", icon: "eye", how: "Show a good move", level: 7 },
  { key: "block", name: "Block Column", icon: "x", how: "Block a column", level: 12, pickCol: true },
];
export function dlPerk(key: string | null | undefined) {
  return DL_PERKS.find((p) => p.key === key) ?? null;
}

const credsKey = (code: string) => `slimpse_dl:${code.toUpperCase()}`;
export function loadDlCreds(code: string): DlCreds | null {
  try {
    const raw = localStorage.getItem(credsKey(code));
    return raw ? (JSON.parse(raw) as DlCreds) : null;
  } catch {
    return null;
  }
}
export function saveDlCreds(code: string, c: DlCreds) {
  try {
    localStorage.setItem(credsKey(code), JSON.stringify(c));
  } catch {
    // ignore
  }
}
const PERK_KEY = "slimpse_dl_perk";
export function rememberedDlPerk() {
  try {
    return localStorage.getItem(PERK_KEY);
  } catch {
    return null;
  }
}
export function rememberDlPerk(k: string | null) {
  try {
    if (k) localStorage.setItem(PERK_KEY, k);
    else localStorage.removeItem(PERK_KEY);
  } catch {
    // ignore
  }
}

const ERRORS: Record<string, string> = {
  NOT_YOUR_TURN: "Wait for your turn",
  COLUMN_FULL: "That column is full",
  BLOCKED: "That column is blocked",
  PICK_A_COLUMN: "Tap a column",
  PROTECTED: "That column is protected",
  EMPTY_COLUMN: "That column is empty",
  NOTHING_TO_TAKE: "Nothing to remove",
  NOTHING_TO_UNDO: "Nothing to undo",
  POWER_USED: "Already used",
  POWER_LOCKED: "Unlocks at a higher level",
  TABLE_FULL: "That table is full",
};
export function dlError(e: unknown) {
  const msg = (e as { message?: string })?.message ?? String(e);
  const k = Object.keys(ERRORS).find((x) => msg.includes(x));
  return k ? ERRORS[k] : "Something went wrong. Try again.";
}
