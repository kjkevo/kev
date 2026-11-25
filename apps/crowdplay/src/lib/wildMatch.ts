"use client";

import type { IconName } from "@/components/Icon";

/** Wild Match (wm_* tables, migration 0115). */
export type WmColor = "red" | "blue" | "green" | "yellow";
export type WmRoom = {
  id: string;
  code: string;
  mode: "solo" | "team";
  phase: "lobby" | "playing" | "final";
  starts_at: string | null;
  top: number | null;
  color: WmColor | null;
  turn_seat: number;
  direction: number;
  turn_started_at: string | null;
  deck_left: number;
  plays?: number;
  winner_seat: number | null;
  winner_team: number | null;
  log: { id: number; text: string }[];
  now: string;
  venue: string | null;
  full: boolean;
  private?: boolean;
  next_code?: string | null;
};
export type WmPlayer = {
  id: string;
  seat: number;
  team: number;
  nickname: string;
  avatar_id: string | null;
  is_bot: boolean;
  cards: number;
  char_power: string | null;
  char_used: boolean;
  power: string | null;
  power_used: boolean;
  shield: boolean;
  left: boolean;
};
export type WmMe = { id: string; seat: number; team: number; hand: number[]; free_play: boolean; extra_turn: boolean; skip_next: boolean };
export type WmState = { room: WmRoom | null; players: WmPlayer[]; me: WmMe | null };
export type WmCreds = { roomId: string; playerId: string; clientToken: string; seat: number };

export const WM_TURN_SECONDS = 25;
export const WM_COLORS: WmColor[] = ["red", "blue", "green", "yellow"];

/** Card ids match the server: 0-99 colored (color = id / 25), 100-103 Pick (choose the color), 104-107 Take 4. */
export function wmColor(c: number): WmColor | null {
  return c < 100 ? WM_COLORS[Math.floor(c / 25)] : null;
}
/** Inside a color (id % 25): 0-15 numbers 1-8, 16-17 Block, 18-19 Flip, 20-21 Take 2, 22-23 Again. */
export function wmKind(c: number): string {
  if (c >= 104) return "wild4";
  if (c >= 100) return "wild";
  const r = c % 25;
  if (r <= 15) return String(Math.floor(r / 2) + 1);
  if (r <= 17) return "skip";
  if (r <= 19) return "flip";
  if (r <= 21) return "draw2";
  return "again";
}
/** What's printed on the card, big. */
export function wmLabel(c: number): string {
  const k = wmKind(c);
  return k === "wild4" ? "Take 4" : k === "wild" ? "Pick" : k === "skip" ? "Block" : k === "flip" ? "Flip" : k === "draw2" ? "Take 2" : k === "again" ? "Again" : k;
}
export function wmPlayable(c: number, top: number | null, color: WmColor | null, free: boolean) {
  return free || c >= 100 || wmColor(c) === color || (top !== null && top < 100 && wmKind(c) === wmKind(top));
}
/**
 * Wild Match's own look (kept far from other card games): the four colors
 * are Pink, Purple, Teal and Orange, each with its own symbol. The server
 * still calls them red, blue, green and yellow.
 */
export const WM_NAME: Record<WmColor, string> = { red: "Pink", blue: "Purple", green: "Teal", yellow: "Orange" };
export const WM_BG: Record<WmColor, string> = {
  red: "bg-pink-500",
  blue: "bg-violet-600",
  green: "bg-teal-400",
  yellow: "bg-orange-500",
};
export const WM_BORDER: Record<WmColor, string> = {
  red: "border-pink-400",
  blue: "border-violet-400",
  green: "border-teal-300",
  yellow: "border-orange-400",
};
export const WM_TEXT: Record<WmColor, string> = {
  red: "text-pink-300",
  blue: "text-violet-300",
  green: "text-teal-200",
  yellow: "text-orange-300",
};
export const WM_SYMBOL: Record<WmColor, IconName> = { red: "star", blue: "crown", green: "bolt", yellow: "flame" };

/** Each character's own power in Wild Match (matches wm_char_power). */
export const WM_CHAR_POWERS: Record<string, { name: string; icon: IconName; how: string; pickCard?: boolean; ready?: { after: number; label: string } }> = {
  trailblaze: { name: "Trailblaze", icon: "bolt", how: "Play any card next" },
  shield: { name: "Crystal Shield", icon: "check", how: "Blocks the next Take 2 or Take 4" },
  probe: { name: "Mind Probe", icon: "eye", how: "See the next player's cards" },
  patience: { name: "Patience", icon: "clock", how: "Pass without drawing" },
  bloom: { name: "Bloom", icon: "up", how: "Toss 1 card", pickCard: true, ready: { after: 8, label: "Ready after 8 cards" } },
  riddle: { name: "Riddle Sight", icon: "star", how: "Draw a card you can play" },
  rift: { name: "Void Rift", icon: "target", how: "Swap a card with the leader" },
  overclock: { name: "Overclock", icon: "bolt", how: "Take 2 turns", ready: { after: 8, label: "Ready after 8 cards" } },
  secondwind: { name: "Second Wind", icon: "swap", how: "Toss 2 cards, draw 1", ready: { after: 8, label: "Ready after 8 cards" } },
};

/** Wild Match perks: earned by leveling up, bring one per game. */
export const WM_PERKS: { key: string; name: string; icon: IconName; how: string; level: number }[] = [
  { key: "color", name: "Color Call", icon: "star", how: "Pick the color", level: 3 },
  { key: "skip", name: "Skip Them", icon: "x", how: "Skip the next player", level: 7 },
  { key: "wildcard", name: "Wild Card", icon: "cards", how: "Get a Wild card", level: 12 },
];
export function wmPerk(key: string | null | undefined) {
  return WM_PERKS.find((p) => p.key === key) ?? null;
}

const credsKey = (code: string) => `slimpse_wm:${code.toUpperCase()}`;
export function loadWmCreds(code: string): WmCreds | null {
  try {
    const raw = localStorage.getItem(credsKey(code));
    return raw ? (JSON.parse(raw) as WmCreds) : null;
  } catch {
    return null;
  }
}
export function saveWmCreds(code: string, c: WmCreds) {
  try {
    localStorage.setItem(credsKey(code), JSON.stringify(c));
  } catch {
    // ignore
  }
}
const PERK_KEY = "slimpse_wm_perk";
export function rememberedWmPerk() {
  try {
    return localStorage.getItem(PERK_KEY);
  } catch {
    return null;
  }
}
export function rememberWmPerk(k: string | null) {
  try {
    if (k) localStorage.setItem(PERK_KEY, k);
    else localStorage.removeItem(PERK_KEY);
  } catch {
    // ignore
  }
}

const ERRORS: Record<string, string> = {
  NOT_YOUR_TURN: "Wait for your turn",
  CANT_PLAY: "That card doesn't match",
  PICK_A_COLOR: "Pick a color",
  PICK_A_CARD: "Tap a card",
  POWER_USED: "Already used",
  POWER_LOCKED: "Unlocks at a higher level",
  TOO_FEW_CARDS: "You need 3 cards",
  LAST_CARD: "Not your last card",
  NO_RIVAL: "No one to swap with",
  NONE_LEFT: "No Wild cards left",
  TABLE_FULL: "That table is full",
  NOT_YET: "Not ready yet",
  CHECK_IN: "Scan the code on the TV to play",
  TOO_FAST: "Slow down. Try again in a minute.",
  PRIVATE_STARTED: "That game already started",
};
export function wmError(e: unknown) {
  const msg = (e as { message?: string })?.message ?? String(e);
  const k = Object.keys(ERRORS).find((x) => msg.includes(x));
  return k ? ERRORS[k] : "Something went wrong. Try again.";
}
