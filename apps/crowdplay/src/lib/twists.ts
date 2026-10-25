/**
 * Game twists (see 0085_game_twists.sql). 2-3 per game at random spots,
 * each announced on a 7-second intro screen before it plays.
 */
export type Twist = "lightning" | "comeback" | "bounty" | "golden" | "captain" | "sabotage";

/** Seconds the intro screen shows (matches v_twist_intro_seconds in tick()). */
export const TWIST_INTRO_SECONDS = 7;
/** Seconds a fog blocks a team from answering (matches trivia_fog_until()). */
export const FOG_SECONDS = 3;

export const TWISTS: Record<Twist, { icon: string; title: string; color: string; glow: string }> = {
  lightning: { icon: "⚡", title: "Lightning Round", color: "text-yellow-300", glow: "rgba(250,204,21,0.28)" },
  comeback: { icon: "🔼", title: "Comeback Bonus", color: "text-emerald-300", glow: "rgba(52,211,153,0.25)" },
  bounty: { icon: "💰", title: "Bounty", color: "text-amber-300", glow: "rgba(251,191,36,0.28)" },
  golden: { icon: "🌟", title: "Golden Question", color: "text-amber-200", glow: "rgba(252,211,77,0.35)" },
  captain: { icon: "👑", title: "Team Captain's Call", color: "text-fuchsia-300", glow: "rgba(232,121,249,0.25)" },
  sabotage: { icon: "🌫️", title: "Sabotage", color: "text-sky-300", glow: "rgba(56,189,248,0.25)" },
};

export function isTwist(t: string | null | undefined): t is Twist {
  return !!t && t in TWISTS;
}

/** Names the description needs: teams by id, players by id. */
export type TwistContext = {
  teamName: (id: string) => string;
  playerName: (id: string) => string;
  myTeamId?: string | null;
  myPlayerId?: string | null;
  twistTeams?: string[] | null;
  captains?: Record<string, string> | null;
};

function list(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The intro screen's description, everyone's version (the TV). */
export function twistDescription(twist: Twist, ctx: TwistContext): string {
  const targets = (ctx.twistTeams ?? []).map(ctx.teamName);
  switch (twist) {
    case "lightning":
      return "3 rapid-fire questions. 8 seconds each. Double points!";
    case "comeback":
      return targets.length > 0
        ? `Last place (${list(targets)}) scores 1.5× on this question. Time to catch up!`
        : "Last place scores 1.5× on this question. Time to catch up!";
    case "bounty":
      return targets.length > 0
        ? `${targets[0]} is in 1st. If they miss this one, every team that gets it right wins +500.`
        : "1st place is the target. If they miss, every team that gets it right wins +500.";
    case "golden":
      return "This one's worth triple points.";
    case "captain":
      return "One player answers for the whole team. No help allowed!";
    case "sabotage":
      return "Every team gets one fog to throw at another team. A fogged team can't answer for 3 seconds.";
  }
}

/** A line just for this player's team on the intro screen, if any. */
export function twistPersonalLine(twist: Twist, ctx: TwistContext): string | null {
  const mine = !!ctx.myTeamId && (ctx.twistTeams ?? []).includes(ctx.myTeamId);
  if (twist === "comeback" && mine) return "That's you! Your points are 1.5× on this one.";
  if (twist === "bounty" && mine) return "That's you! Get it right so nobody cashes in.";
  if (twist === "captain" && ctx.myTeamId && ctx.captains?.[ctx.myTeamId]) {
    const cap = ctx.captains[ctx.myTeamId];
    return cap === ctx.myPlayerId ? "You're the captain! Your answer is your team's answer." : `Your captain: ${ctx.playerName(cap)}`;
  }
  if (twist === "sabotage") return "Tap a team's name during the question to fog them.";
  return null;
}

/** The short banner during the question and the reveal. */
export function twistBanner(twist: Twist, seq: number | null | undefined, ctx: TwistContext): string {
  const t = TWISTS[twist];
  const targets = (ctx.twistTeams ?? []).map(ctx.teamName);
  switch (twist) {
    case "lightning":
      return `${t.icon} Lightning ${seq ?? 1}/3 · 2× points`;
    case "comeback":
      return `${t.icon} Comeback · ${targets.length > 0 ? list(targets) : "last place"} 1.5×`;
    case "bounty":
      return `${t.icon} Bounty on ${targets[0] ?? "1st place"} · +500`;
    case "golden":
      return `${t.icon} Golden question · 3× points`;
    case "captain": {
      const cap = ctx.myTeamId ? ctx.captains?.[ctx.myTeamId] : undefined;
      return `${t.icon} Captain's call${cap ? ` · ${cap === ctx.myPlayerId ? "You're the captain" : `Captain: ${ctx.playerName(cap)}`}` : ""}`;
    }
    case "sabotage":
      return `${t.icon} Sabotage · fog another team`;
  }
}

/** When a team's fog wears off: each fog adds 3 seconds, stacking (same as the server). */
export function fogUntil(fogs: { to_team: string; thrown_at: string }[], teamId: string | null | undefined): number {
  if (!teamId) return 0;
  let end = 0;
  for (const f of fogs.filter((x) => x.to_team === teamId).sort((a, b) => Date.parse(a.thrown_at) - Date.parse(b.thrown_at))) {
    end = Math.max(end, Date.parse(f.thrown_at)) + FOG_SECONDS * 1000;
  }
  return end;
}
