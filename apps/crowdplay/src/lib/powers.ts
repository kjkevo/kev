/**
 * Each character's power-up. Every player can use their character's power
 * once per game, during a question, and only one power per team per
 * question (so teammates can't stack them). The rules live in use_power()
 * in the database; this is what the screens say about them.
 */
export const POWERS_LIVE = true;

export type PowerKey =
  | "trailblaze"
  | "shield"
  | "probe"
  | "patience"
  | "bloom"
  | "riddle"
  | "rift"
  | "overclock"
  | "second_wind";

/** When it can be used: before the team locks in, after, or any time. */
export type PowerTiming = "before" | "after" | "any";

export type Power = {
  key: PowerKey;
  name: string;
  /** How it works, for the character picker. */
  how: string;
  timing: PowerTiming;
  /** Only on multiple-choice questions. */
  choicesOnly?: boolean;
};

export const POWERS: Record<string, Power> = {
  "jungle-scout": { key: "trailblaze", name: "Trailblaze", timing: "before", choicesOnly: true,
    how: "Removes 2 wrong answers" },
  "crystal-titan": { key: "shield", name: "Crystal Shield", timing: "before",
    how: "Wrong? Still get 300 points" },
  "alien-buddy": { key: "probe", name: "Mind Probe", timing: "before", choicesOnly: true,
    how: "See everyone's votes live" },
  "forest-guardian": { key: "patience", name: "Patience", timing: "before",
    how: "Full points, no rush" },
  "sylvan-entity": { key: "bloom", name: "Bloom", timing: "before",
    how: "+300 points if right" },
  "geo-sphinx": { key: "riddle", name: "Riddle Sight", timing: "before",
    how: "Free clue" },
  "void-walker": { key: "rift", name: "Void Rift", timing: "any",
    how: "Steal 300 from the leader" },
  "model-z": { key: "overclock", name: "Overclock", timing: "before",
    how: "Double points if right" },
  "stone-golem": { key: "second_wind", name: "Second Wind", timing: "after",
    how: "After you answer: wrong? Try again" },
};

const BY_KEY = Object.fromEntries(Object.values(POWERS).map((p) => [p.key, p])) as Record<PowerKey, Power>;

export function powerFor(avatarId: string | null | undefined): Power | null {
  return avatarId ? POWERS[avatarId] ?? null : null;
}

/** The face of the character a power belongs to (shown instead of an icon). */
export function powerFace(key: string | null | undefined): string | null {
  const id = Object.keys(POWERS).find((a) => POWERS[a].key === key);
  return id ? `/avatars/${id}-256.png` : null;
}

export function powerByKey(key: string | null | undefined): Power | null {
  return key ? BY_KEY[key as PowerKey] ?? null : null;
}

/** What a power showed the team (from use_power / get_team_powers). */
export type PowerData = {
  removed?: string[];
  counts?: Record<string, number>;
  total?: number;
  hint?: string;
  target_name?: string;
  amount?: number;
  result?: "right" | "wrong";
  answer?: string;
};

/** The one-line "what happened" a team sees after a power is used. */
export function powerResultLine(key: string, data: PowerData | null | undefined): string {
  const d = data ?? {};
  switch (key) {
    case "trailblaze":
      return "2 wrong answers removed";
    case "shield":
      return "Shield up: 300 even if wrong";
    case "probe":
      return "Everyone's votes, live";
    case "patience":
      return "Full points, take your time";
    case "bloom":
      return "+300 if right";
    case "riddle":
      return "Free clue below";
    case "rift":
      return `Stole ${d.amount ?? 300} from ${d.target_name ?? "the leader"}`;
    case "overclock":
      return "Double points if right";
    case "second_wind":
      return d.result === "right"
        ? "You're right!"
        : `"${d.answer ?? "That"}" is wrong. Try again (half points)`;
    default:
      return "";
  }
}

/** What everyone in the room is told a power did (the TV feed). */
export function powerPublicLine(key: string, amount: number, targetName?: string): string {
  switch (key) {
    case "trailblaze":
      return "cleared 2 wrong answers";
    case "shield":
      return "is shielded: 300 even if wrong";
    case "probe":
      return "peeked at everyone's votes";
    case "patience":
      return "gets full speed points";
    case "bloom":
      return "+300 if they get it right";
    case "riddle":
      return "got a free clue";
    case "rift":
      return `stole ${amount} from ${targetName ?? "the leader"}`;
    case "overclock":
      return "double points if right";
    case "second_wind":
      return "checked their answer";
    default:
      return "";
  }
}

/** The short tag next to a team's points after a question, so a big (or
 * missing) score explains itself. The team that lost points to a Void Rift
 * gets its own tag. */
export function powerScoreTag(key: string, amount: number, stolenFrom: boolean): string {
  if (key === "rift") return stolenFrom ? `−${amount} stolen` : `+${amount} stolen`;
  const p = powerByKey(key);
  const what: Record<string, string> = {
    trailblaze: "Trailblaze",
    shield: "Shield",
    probe: "Mind Probe",
    patience: "Full speed",
    bloom: "+300 Bloom",
    riddle: "Free clue",
    overclock: "Overclock",
    second_wind: "Second Wind",
  };
  return what[key] ?? p?.name ?? "";
}

/** Server errors from use_power, in plain words. */
export function powerErrorText(message: string): string {
  if (/POWER_USED/.test(message)) return "Already used this game";
  if (/TEAM_POWER_TAKEN/.test(message)) return "A teammate used one here";
  if (/TEAM_LOCKED_IN/.test(message)) return "Use it before you answer";
  if (/NOT_LOCKED_YET/.test(message)) return "Answer first, then use it";
  if (/OPEN_QUESTION/.test(message)) return "Multiple choice only";
  if (/NO_VOTES_YET/.test(message)) return "Try again in a moment";
  if (/HINT_ALREADY_USED/.test(message)) return "You already have the clue";
  if (/NOTHING_TO_STEAL/.test(message)) return "Nobody has points yet";
  if (/FOGGED/.test(message)) return "Fogged! Wait a second";
  if (/TIME_EXPIRED|NOT_ACCEPTING_ANSWERS|STALE_QUESTION/.test(message)) return "Too late";
  if (/NO_POWER/.test(message)) return "Your character has no power.";
  return "Didn't work. Try again.";
}
