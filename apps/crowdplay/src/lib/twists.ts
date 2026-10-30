/**
 * Game twists (see 0085_game_twists.sql). 2-3 per game at random spots,
 * each announced on a 7-second intro screen before it plays.
 */
export type Twist = "lightning" | "comeback" | "bounty" | "golden" | "captain" | "sabotage";

/** Seconds the intro screen shows (matches v_twist_intro_seconds in tick()). */
export const TWIST_INTRO_SECONDS = 7;
/** Seconds a fog blocks a team from answering (matches trivia_fog_until()). */
export const FOG_SECONDS = 3;

export const TWISTS: Record<Twist, { title: string; icon: string; color: string; glow: string }> = {
  lightning: { title: "Lightning Round", icon: "bolt", color: "text-yellow-300", glow: "rgba(250,204,21,0.28)" },
  comeback: { title: "Comeback", icon: "up", color: "text-emerald-300", glow: "rgba(52,211,153,0.25)" },
  bounty: { title: "Bounty", icon: "target", color: "text-amber-300", glow: "rgba(251,191,36,0.28)" },
  golden: { title: "Golden Question", icon: "star", color: "text-amber-200", glow: "rgba(252,211,77,0.35)" },
  captain: { title: "Captain's Call", icon: "user", color: "text-fuchsia-300", glow: "rgba(232,121,249,0.25)" },
  sabotage: { title: "Sabotage", icon: "cloud", color: "text-sky-300", glow: "rgba(56,189,248,0.25)" },
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

/** The intro screen's big line (what you win) and small line (when),
 * everyone's version (the TV). Kept to a few words. */
export function twistDescription(twist: Twist, ctx: TwistContext): { headline: string; sub?: string } {
  const target = (ctx.twistTeams ?? []).map(ctx.teamName)[0];
  switch (twist) {
    case "lightning":
      return { headline: "2× points", sub: "3 quick questions · 8 sec" };
    case "comeback":
      return { headline: "1.5× points", sub: `For last place${target ? `: ${target}` : ""}` };
    case "bounty":
      return { headline: "+500", sub: `If ${target ?? "1st place"} gets it wrong` };
    case "golden":
      return { headline: "3× points" };
    case "captain":
      return { headline: "Captain answers", sub: "One player answers for the team" };
    case "sabotage":
      return { headline: "Fog a rival", sub: "They can't answer for 3 sec" };
  }
}

/** A line just for this player on the intro screen, if any. */
export function twistPersonalLine(twist: Twist, ctx: TwistContext): string | null {
  const mine = !!ctx.myTeamId && (ctx.twistTeams ?? []).includes(ctx.myTeamId);
  if (twist === "comeback" && mine) return "That's you!";
  if (twist === "bounty" && mine) return "That's you! Don't miss";
  if (twist === "captain" && ctx.myTeamId && ctx.captains?.[ctx.myTeamId]) {
    const cap = ctx.captains[ctx.myTeamId];
    return cap === ctx.myPlayerId ? "You're the captain!" : `Captain: ${ctx.playerName(cap)}`;
  }
  if (twist === "sabotage") return "Tap a name to fog it";
  return null;
}

/** The short banner during the question and the reveal. */
export function twistBanner(twist: Twist, seq: number | null | undefined, ctx: TwistContext): string {
  const targets = (ctx.twistTeams ?? []).map(ctx.teamName);
  switch (twist) {
    case "lightning":
      return `Lightning ${seq ?? 1}/3 · 2× points`;
    case "comeback":
      return `Comeback · ${targets.length > 0 ? list(targets) : "last place"} 1.5×`;
    case "bounty":
      return `Bounty on ${targets[0] ?? "1st place"} · +500`;
    case "golden":
      return `Golden question · 3× points`;
    case "captain": {
      const cap = ctx.myTeamId ? ctx.captains?.[ctx.myTeamId] : undefined;
      return `Captain's call${cap ? ` · ${cap === ctx.myPlayerId ? "You're the captain" : `Captain: ${ctx.playerName(cap)}`}` : ""}`;
    }
    case "sabotage":
      return `Sabotage · fog a rival`;
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
