import type { Season } from "@/hooks/useSeason";

/** "September season · usernames and leaderboards reset October 1". */
export function SeasonNotice({ season, compact = false }: { season: Season | null; compact?: boolean }) {
  if (!season) return null;
  return (
    <div
      className={`w-full max-w-sm rounded-2xl border border-amber-400/30 bg-amber-400/10 text-center ${compact ? "px-3 py-2" : "px-4 py-3"}`}
    >
      <p className="text-sm font-bold text-amber-300">{season.month} Season</p>
      <p className="text-xs text-slate-300">
        Leaderboards and usernames reset on {season.resetsOn}. Everyone starts fresh and picks a new username.
      </p>
    </div>
  );
}
