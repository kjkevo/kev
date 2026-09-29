import type { Season } from "@/hooks/useSeason";

/** "Sept · resets Oct 1": usernames and leaderboards reset on the 1st. */
export function SeasonChip({ season }: { season: Season | null }) {
  if (!season) return null;
  const short = (s: string) => s.replace(/^September/, "Sept").replace(/^(?!Sept)(\w{3})\w*/, "$1");
  return (
    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300 whitespace-nowrap">
      {short(season.month)} · resets {short(season.resetsOn)}
    </span>
  );
}
