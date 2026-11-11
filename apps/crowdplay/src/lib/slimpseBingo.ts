"use client";

import { supabase } from "@/lib/supabase";
import { deviceKey } from "@/lib/device";
import { randomFunName } from "@/lib/funNames";
import type { IconName } from "@/components/Icon";

/** Slimpse Bingo (sb_* tables, migration 0113). */
export type SbRoom = {
  id: string;
  code: string;
  mode: "solo" | "team";
  phase: "lobby" | "playing" | "final";
  starts_at: string | null;
  calls: number[];
  last_call_at: string | null;
  winner_team_id: string | null;
  ended_at: string | null;
  now: string;
  venue: string | null;
  /** Enough real players that the countdown dropped to 10 seconds. */
  full?: boolean;
};
export type SbTeam = {
  id: string;
  name: string;
  is_bot: boolean;
  card: number[];
  marks: boolean[];
  /** Numbers up to this many calls mark themselves (Trailblaze, Overclock). */
  auto_until?: number;
  /** Can't mark until then (hit by Overgrowth). */
  frozen_until?: string | null;
};
export type SbPlayer = {
  id: string;
  team_id: string;
  nickname: string;
  avatar_id: string | null;
  is_bot: boolean;
  power: string | null;
  power_used: boolean;
  char_power?: string | null;
  char_used?: boolean;
  char_data?: { power?: string; target_name?: string; removed?: number; number?: number } | null;
  left: boolean;
};
export type SbState = { room: SbRoom | null; teams: SbTeam[]; players: SbPlayer[] };
export type SbCreds = { roomId: string; playerId: string; clientToken: string; teamId: string };

/** Seconds between called numbers (matches sb_tick). */
export const SB_CALL_SECONDS = 6;

/** Bingo perks: earned by leveling up (like Trivia's), bring one per game. */
export type SbPowerKey = "peek" | "fresh" | "wild";
export const SB_POWERS: Record<SbPowerKey, { key: SbPowerKey; name: string; icon: IconName; how: string; level: number }> = {
  peek: { key: "peek", name: "Sneak Peek", icon: "eye", how: "See the next number before it's called", level: 3 },
  fresh: { key: "fresh", name: "Fresh Card", icon: "swap", how: "Swap for a brand-new card (first 5 numbers only)", level: 7 },
  wild: { key: "wild", name: "Lucky Square", icon: "star", how: "Mark any square on your card, called or not", level: 12 },
};

/** Each character's own power in Bingo (once per game; matches sb_char_power). */
export const SB_CHAR_POWERS: Record<string, { key: string; name: string; icon: IconName; how: string; pick?: "any" | "unmarked" }> = {
  trailblaze: { key: "trailblaze", name: "Trailblaze", icon: "bolt", how: "The next 3 numbers called mark themselves" },
  catchup: { key: "catchup", name: "Catch Up", icon: "check", how: "Marks every called number you missed" },
  probe: { key: "probe", name: "Mind Probe", icon: "eye", how: "See the next 2 numbers before they're called" },
  rebuild: { key: "rebuild", name: "Rebuild", icon: "swap", how: "Swap one unmarked square for a number already called", pick: "unmarked" },
  secondwind: { key: "secondwind", name: "Second Wind", icon: "up", how: "A new card with every called number already marked" },
  rift: { key: "rift", name: "Void Rift", icon: "target", how: "Removes 2 marks from the rival closest to Bingo" },
  overgrowth: { key: "overgrowth", name: "Overgrowth", icon: "cloud", how: "The rival closest to Bingo can't mark for 15 seconds" },
  riddle: { key: "riddle", name: "Riddle Sight", icon: "star", how: "Mark any one square, called or not", pick: "any" },
  overclock: { key: "overclock", name: "Overclock", icon: "bolt", how: "The next 5 numbers called mark themselves" },
};
export function sbCharPower(key: string | null | undefined) {
  return key ? SB_CHAR_POWERS[key] ?? null : null;
}
export function sbPower(key: string | null | undefined) {
  return key && key in SB_POWERS ? SB_POWERS[key as SbPowerKey] : null;
}

export function sbLetter(n: number) {
  return "BINGO"[Math.floor((n - 1) / 15)] ?? "";
}

/** Every full row, column and diagonal (0-based squares). */
const LINES = [
  [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
];
export function sbHasLine(marks: boolean[]) {
  return LINES.some((l) => l.every((i) => marks[i]));
}
/** The most squares marked in any one line (how close a card is). */
export function sbBestLine(marks: boolean[]) {
  return Math.max(...LINES.map((l) => l.filter((i) => marks[i]).length));
}

const credsKey = (code: string) => `slimpse_bingo:${code.toUpperCase()}`;
export function loadSbCreds(code: string): SbCreds | null {
  try {
    const raw = localStorage.getItem(credsKey(code));
    return raw ? (JSON.parse(raw) as SbCreds) : null;
  } catch {
    return null;
  }
}
export function saveSbCreds(code: string, creds: SbCreds) {
  try {
    localStorage.setItem(credsKey(code), JSON.stringify(creds));
  } catch {
    // storage blocked: the game still works until the page reloads
  }
}

const POWER_PICK = "slimpse_bingo_power";
export function rememberedSbPower(): string | null {
  try {
    return localStorage.getItem(POWER_PICK);
  } catch {
    return null;
  }
}
export function rememberSbPower(key: string | null) {
  try {
    if (key) localStorage.setItem(POWER_PICK, key);
    else localStorage.removeItem(POWER_PICK);
  } catch {
    // ignore
  }
}

/**
 * This phone's name for the month (the same one Trivia uses). A first-timer
 * gets a fun random name claimed for them, so joining is one tap.
 */
export async function ensurePlayName(venue: string): Promise<string> {
  const { data } = await supabase.rpc("get_season_profile", { p_device_key: deviceKey(), p_venue: venue });
  const existing = data?.[0]?.o_username;
  if (existing) return existing;
  for (let i = 0; i < 4; i++) {
    const claim = await supabase.rpc("claim_season_username", { p_device_key: deviceKey(), p_venue: venue, p_username: randomFunName() });
    const name = claim.data?.[0]?.o_username;
    if (name) return name;
  }
  return randomFunName();
}

export const SB_ERRORS: Record<string, string> = {
  NOT_CALLED: "That number hasn't been called yet",
  NO_LINE: "Not yet. You need a full line.",
  TOO_LATE: "Fresh Card only works in the first 5 numbers",
  POWER_USED: "Already used this game",
  POWER_LOCKED: "Unlocks at a higher level",
  PICK_A_SQUARE: "Tap a square to mark",
  TEAM_FULL: "That team is full",
  FROZEN: "Your card is frozen for a few seconds",
  NO_RIVAL: "No rival to aim at yet",
  NOTHING_TO_SWAP: "No called number to swap in yet",
  ALREADY_STARTED: "That team game already started",
};
export function sbError(e: unknown) {
  const msg = (e as { message?: string })?.message ?? String(e);
  const key = Object.keys(SB_ERRORS).find((k) => msg.includes(k));
  return key ? SB_ERRORS[key] : "Something went wrong. Try again.";
}
