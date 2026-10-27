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
  icon: string;
  name: string;
  /** How it works, for the character picker. */
  how: string;
  timing: PowerTiming;
  /** Only on multiple-choice questions. */
  choicesOnly?: boolean;
};

export const POWERS: Record<string, Power> = {
  "jungle-scout": { key: "trailblaze", icon: "🌿", name: "Trailblaze", timing: "before", choicesOnly: true,
    how: "Clears two wrong answers off your team's choices." },
  "crystal-titan": { key: "shield", icon: "💎", name: "Crystal Shield", timing: "before",
    how: "If your team gets the question wrong, you still score 300." },
  "alien-buddy": { key: "probe", icon: "🛸", name: "Mind Probe", timing: "before", choicesOnly: true,
    how: "See how the other teams are voting. They might be wrong!" },
  "forest-guardian": { key: "patience", icon: "🛡️", name: "Patience", timing: "before",
    how: "Full speed points on the question, however long your team takes." },
  "sylvan-entity": { key: "bloom", icon: "🌸", name: "Bloom", timing: "before",
    how: "+300 bonus points if your team gets the question right." },
  "geo-sphinx": { key: "riddle", icon: "🔮", name: "Riddle Sight", timing: "before",
    how: "Get the question's clue for free. No points taken off." },
  "void-walker": { key: "rift", icon: "🌀", name: "Void Rift", timing: "any",
    how: "Steal 300 points from the team in first place (2nd place if that's you)." },
  "model-z": { key: "overclock", icon: "⚡", name: "Overclock", timing: "before",
    how: "Double points if your team gets it right (×4 on a ×3 Golden question)." },
  "stone-golem": { key: "second_wind", icon: "🪨", name: "Second Wind", timing: "after",
    how: "After your team locks in, check the answer. If it's wrong, you get one more try for half points." },
};

const BY_KEY = Object.fromEntries(Object.values(POWERS).map((p) => [p.key, p])) as Record<PowerKey, Power>;

export function powerFor(avatarId: string | null | undefined): Power | null {
  return avatarId ? POWERS[avatarId] ?? null : null;
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
      return "Two wrong answers are gone.";
    case "shield":
      return "Shield up: 300 points even if you're wrong.";
    case "probe":
      return "Here's how the other teams are voting.";
    case "patience":
      return "No rush: full speed points on this one.";
    case "bloom":
      return "+300 bonus if your team gets it right.";
    case "riddle":
      return "Free clue below. No points taken off.";
    case "rift":
      return `Stole ${d.amount ?? 300} points from ${d.target_name ?? "the leader"}!`;
    case "overclock":
      return "Double points if your team gets it right (×4 on Golden).";
    case "second_wind":
      return d.result === "right"
        ? `Your answer is right! Nothing to fix.`
        : `"${d.answer ?? "That"}" was wrong. Answer again for half points!`;
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
  if (key === "rift") return stolenFrom ? `🌀 −${amount} stolen` : `🌀 +${amount} stolen`;
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
  return `${p?.icon ?? "⚡"} ${what[key] ?? p?.name ?? ""}`;
}

/** Server errors from use_power, in plain words. */
export function powerErrorText(message: string): string {
  if (/POWER_USED/.test(message)) return "You've already used your power this game.";
  if (/TEAM_POWER_TAKEN/.test(message)) return "A teammate already used a power on this question.";
  if (/TEAM_LOCKED_IN/.test(message)) return "Your team already locked in. Use it before you lock in.";
  if (/NOT_LOCKED_YET/.test(message)) return "Lock in an answer first, then use it.";
  if (/OPEN_QUESTION/.test(message)) return "This one only works on multiple-choice questions.";
  if (/NO_VOTES_YET/.test(message)) return "No other team has voted yet. Try again in a moment.";
  if (/HINT_ALREADY_USED/.test(message)) return "Your team already has the clue.";
  if (/NOTHING_TO_STEAL/.test(message)) return "Nobody has points to steal yet.";
  if (/FOGGED/.test(message)) return "You're fogged! Wait a second.";
  if (/TIME_EXPIRED|NOT_ACCEPTING_ANSWERS|STALE_QUESTION/.test(message)) return "Too late. Time ran out.";
  if (/NO_POWER/.test(message)) return "Your character has no power.";
  return "Didn't work. Try again.";
}
