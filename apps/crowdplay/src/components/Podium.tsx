"use client";

import { Avatar } from "@/components/Avatar";
import type { AvatarOption } from "@/hooks/useAvatars";
import type { Player, Team } from "@/lib/types";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const BLOCK: Record<number, string> = {
  1: "bg-gradient-to-b from-amber-300 to-amber-500 text-black",
  2: "bg-gradient-to-b from-slate-200 to-slate-400 text-black",
  3: "bg-gradient-to-b from-orange-300 to-orange-600 text-black",
};
const HEIGHT: Record<number, [string, string]> = { 1: ["h-32", "h-56"], 2: ["h-24", "h-44"], 3: ["h-20", "h-36"] };

/**
 * The top three teams on a podium (2nd, 1st, 3rd left to right): each
 * team's characters stand on its block, with the team's name and score on
 * the block itself. Ranks not revealed yet show an empty block, so the
 * podium fills in as the reveal plays.
 */
export function Podium({
  placed,
  players,
  avatars,
  teamCount,
  myTeamId,
  big = false,
}: {
  placed: { team: Team; rank: number }[];
  teamCount: number;
  players: Player[];
  avatars: Record<string, AvatarOption>;
  myTeamId?: string | null;
  big?: boolean;
}) {
  const ranks = [2, 1, 3].filter((r) => r <= Math.max(1, teamCount));
  return (
    <div className={`w-full flex items-end justify-center ${big ? "gap-6 max-w-4xl" : "gap-2 max-w-sm"}`}>
      {ranks.map((rank) => {
        const spot = placed.find((p) => p.rank === rank);
        // Everyone still here; if the whole team left, show who played.
        const onTeam = spot ? players.filter((p) => p.team_id === spot.team.id) : [];
        const here = onTeam.filter((p) => !p.left_at);
        const members = (here.length > 0 ? here : onTeam).slice(0, 4);
        const size = (big ? 96 : 52) * (rank === 1 ? 1.15 : 1);
        const mine = spot?.team.id === myTeamId;
        return (
          <div key={rank} className="flex-1 flex flex-col items-center min-w-0">
            {spot && (
              <div className={`flex justify-center animate-pop-in ${big ? "-space-x-6" : "-space-x-4"}`}>
                {members.map((p) => {
                  const a = p.avatar_id ? avatars[p.avatar_id] : undefined;
                  return (
                    <span key={p.id}>
                      <Avatar emoji={a?.emoji} imageUrl={a?.imageUrl} size={size} variant="full" />
                    </span>
                  );
                })}
              </div>
            )}
            <div
              className={`w-full rounded-t-xl flex flex-col items-center justify-start gap-0.5 px-1 pt-1.5 ${BLOCK[rank]} ${
                HEIGHT[rank][big ? 1 : 0]
              } ${spot ? "" : "opacity-40"} ${mine ? "ring-4 ring-white/70" : ""}`}
            >
              <span className={big ? "text-5xl" : "text-2xl"}>{MEDAL[rank]}</span>
              {spot && (
                <>
                  <span className={`font-black text-center leading-tight line-clamp-2 break-words max-w-full ${big ? "text-2xl" : "text-xs"}`}>
                    {spot.team.name}
                  </span>
                  <span className={`font-black tabular-nums text-black/70 ${big ? "text-xl" : "text-xs"}`}>
                    {spot.team.score.toLocaleString()}
                  </span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
