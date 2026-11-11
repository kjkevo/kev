import type { IconName } from "@/components/Icon";

/**
 * Perks: extra power-ups unlocked by leveling up (never sold). A player
 * equips one per game, on top of their character's power, and it can be
 * used once per game. Levels and rules live in the database (perks table,
 * use_perk); this is how each one looks and reads.
 */
export type PerkKey = "time_freeze" | "streak_saver" | "comeback" | "mirror" | "all_in" | "xp_surge";

export type PerkInfo = {
  key: PerkKey;
  name: string;
  icon: IconName;
  how: string;
  /** Tapped during a question (others work on their own). */
  active: boolean;
  /** When it can be tapped, shown on the button while it can't. */
  when?: string;
};

export const PERKS: Record<PerkKey, PerkInfo> = {
  time_freeze: { key: "time_freeze", name: "Time Freeze", icon: "clock", how: "+10 seconds", active: true, when: "Wait 10 seconds" },
  streak_saver: { key: "streak_saver", name: "Streak Saver", icon: "flame", how: "Keep your streak", active: false },
  comeback: { key: "comeback", name: "Comeback Kid", icon: "up", how: "+500 if you're behind", active: true, when: "Later in the game" },
  mirror: { key: "mirror", name: "Mirror", icon: "swap", how: "Blocks a steal", active: false },
  all_in: { key: "all_in", name: "All In", icon: "target", how: "Bet half your points", active: true, when: "Before you answer" },
  xp_surge: { key: "xp_surge", name: "XP Surge", icon: "bolt", how: "Extra XP", active: false },
};

export function perkInfo(key: string | null | undefined): PerkInfo | null {
  return key && key in PERKS ? PERKS[key as PerkKey] : null;
}

const PICK_KEY = "slimpse_perk";

/** The perk this phone picked last, equipped again in the next game. */
export function rememberedPerk(): string | null {
  try {
    return localStorage.getItem(PICK_KEY);
  } catch {
    return null;
  }
}

export function rememberPerk(key: string | null) {
  try {
    if (key) localStorage.setItem(PICK_KEY, key);
    else localStorage.removeItem(PICK_KEY);
  } catch {
    // storage blocked: they pick again next game
  }
}

export const PERK_ERRORS: Record<string, string> = {
  TOO_EARLY: "Not yet",
  NOT_BEHIND: "Only when your team is in the bottom half",
  NOTHING_TO_BET: "You need at least 200 points to go All In",
  TEAM_LOCKED_IN: "Your team already answered",
  TIME_EXPIRED: "Time's up",
  PERK_USED: "Already used this game",
};
