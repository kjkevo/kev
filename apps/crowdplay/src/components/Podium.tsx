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
const HEIGHT: Record<number, [string, string]> = { 1: ["h-24", "h-48"], 2: ["h-16", "h-32"], 3: ["h-11", "h-24"] };

/**
 * The top three teams on a podium, each team's characters standing on its
 * block (2nd, 1st, 3rd left to right). Ranks not revealed yet show an
 * empty block, so the podium fills in as the reveal plays.
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
        const members = spot ? players.filter((p) => p.team_id === spot.team.id && !p.left_at).slice(0, 4) : [];
        const size = (big ? 96 : 44) * (rank === 1 ? 1.2 : 1);
        return (
          <div key={rank} className="flex-1 flex flex-col items-center min-w-0">
            {spot && (
              <div className="flex flex-col items-center animate-pop-in">
                <div className={`flex justify-center ${big ? "-space-x-6" : "-space-x-3"}`}>
                  {members.map((p) => {
                    const a = p.avatar_id ? avatars[p.avatar_id] : undefined;
                    return (
                      <span key={p.id} className={rank === 1 ? "char-cheer" : "char-idle"}>
                        <Avatar emoji={a?.emoji} imageUrl={a?.imageUrl} size={size} variant="full" />
                      </span>
                    );
                  })}
                </div>
                <p
                  className={`mt-1 font-bold text-center truncate max-w-full ${big ? "text-2xl" : "text-xs"} ${
                    spot.team.id === myTeamId ? "text-amber-300" : "text-white"
                  }`}
                >
                  {spot.team.name}
                </p>
                <p className={`font-black tabular-nums ${big ? "text-xl" : "text-xs"} text-slate-300`}>
                  {spot.team.score.toLocaleString()}
                </p>
              </div>
            )}
            <div
              className={`mt-1 w-full rounded-t-xl flex items-start justify-center pt-1 font-black ${BLOCK[rank]} ${
                HEIGHT[rank][big ? 1 : 0]
              } ${big ? "text-5xl" : "text-2xl"} ${spot ? "" : "opacity-40"}`}
            >
              {MEDAL[rank]}
            </div>
          </div>
        );
      })}
    </div>
  );
}
