"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { powerScoreTag } from "@/lib/powers";
import type { RoomPower } from "@/hooks/usePowers";
import { Avatar } from "@/components/Avatar";
import type { AvatarOption } from "@/hooks/useAvatars";
import type { Player } from "@/lib/types";

const PLACE: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd" };
const BLOCK: Record<number, string> = {
  1: "bg-gradient-to-b from-amber-300 to-amber-500 text-black",
  2: "bg-gradient-to-b from-slate-200 to-slate-400 text-black",
  3: "bg-gradient-to-b from-orange-300 to-orange-600 text-black",
};
const HEIGHT: Record<number, [string, string]> = { 1: ["h-28", "h-48"], 2: ["h-24", "h-40"], 3: ["h-20", "h-32"] };

type Standing = { teamId: string; name: string; score: number; points: number; rank: number };

/**
 * The scores after each question: the top 3 on a gold, silver and bronze
 * podium (characters standing on their block, what each just scored above
 * them), and your place if it isn't in the top 3. Solo players show their
 * own name. A power used on
 * the question shows as a tag beside the points, so a doubled (or stolen)
 * score explains itself.
 */
export function RoundStandings({
  roomId,
  questionIndex,
  myTeamId,
  players,
  avatars,
  powers = [],
  big = false,
}: {
  roomId: string;
  questionIndex: number;
  myTeamId?: string | null;
  players: Player[];
  avatars: Record<string, AvatarOption>;
  powers?: RoomPower[];
  big?: boolean;
}) {
  const [rows, setRows] = useState<Standing[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      supabase.rpc("get_round_standings", { p_room_id: roomId }).then(({ data }) => {
        if (cancelled || !data) return;
        setRows(data.map((r) => ({ teamId: r.o_team_id, name: r.o_name, score: r.o_score, points: r.o_points, rank: r.o_rank })));
      });
    load();
    // Scores land a moment after the question closes; read again shortly.
    const t = setTimeout(load, 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [roomId, questionIndex]);

  if (!rows || rows.length === 0) return null;
  const mine = myTeamId ? rows.find((r) => r.teamId === myTeamId) : undefined;
  const membersOf = (teamId: string) => {
    const onTeam = players.filter((p) => p.team_id === teamId);
    const here = onTeam.filter((p) => !p.left_at);
    return (here.length > 0 ? here : onTeam).slice(0, 4);
  };
  // A team of one is a solo player: show their name, not the team's.
  const nameOf = (r: Standing) => {
    const members = membersOf(r.teamId);
    return members.length === 1 ? members[0].nickname : r.name;
  };
  const solo = !!mine && membersOf(mine.teamId).length <= 1;
  const tagsFor = (teamId: string) => [
    ...powers.filter((p) => p.team_id === teamId).map((p) => powerScoreTag(p.power, p.amount, false)),
    ...powers.filter((p) => p.power === "rift" && p.target_team_id === teamId).map((p) => powerScoreTag(p.power, p.amount, true)),
  ];
  const ranks = [2, 1, 3].filter((rank) => rows.some((r) => r.rank === rank));

  return (
    <div className={`w-full flex flex-col items-center ${big ? "gap-4 max-w-4xl" : "gap-3"}`}>
      <div className={`w-full flex items-end justify-center ${big ? "gap-6" : "gap-2"}`}>
        {ranks.map((rank, i) => {
          const r = rows.find((x) => x.rank === rank)!;
          const members = membersOf(r.teamId);
          const size = (big ? 96 : 52) * (rank === 1 ? 1.15 : 1);
          const isMine = r.teamId === myTeamId;
          return (
            <div
              key={r.teamId}
              className="flex-1 min-w-0 flex flex-col items-center animate-pop-in"
              style={{ animationDelay: `${i * 120}ms`, animationFillMode: "both" }}
            >
              {tagsFor(r.teamId).map((tag) => (
                <span
                  key={tag}
                  className={`mb-1 max-w-full truncate rounded-full bg-violet-500/20 border border-violet-400/50 text-violet-100 font-bold ${
                    big ? "text-base px-3 py-0.5" : "text-[10px] px-2 py-0.5"
                  }`}
                >
                  {tag}
                </span>
              ))}
              {r.points > 0 && (
                <span className={`mb-1 rounded-full bg-emerald-400 text-black font-black tabular-nums ${big ? "text-xl px-3 py-0.5" : "text-xs px-2 py-0.5"}`}>
                  +{r.points.toLocaleString()}
                </span>
              )}
              <div className={`flex justify-center ${big ? "-space-x-6" : "-space-x-4"}`}>
                {members.map((p) => {
                  const a = p.avatar_id ? avatars[p.avatar_id] : undefined;
                  return <Avatar key={p.id} emoji={a?.emoji} imageUrl={a?.imageUrl} size={size} variant="full" />;
                })}
              </div>
              <div
                className={`w-full rounded-t-xl flex flex-col items-center gap-0.5 px-1 pt-1.5 ${BLOCK[rank]} ${HEIGHT[rank][big ? 1 : 0]} ${
                  isMine ? "ring-4 ring-white/80" : ""
                }`}
              >
                <span className={`font-black ${big ? "text-4xl" : "text-xl"}`}>{PLACE[rank]}</span>
                <span className={`font-black text-center leading-tight line-clamp-2 break-words max-w-full ${big ? "text-2xl" : "text-xs"}`}>
                  {isMine ? "You" : nameOf(r)}
                </span>
                <span className={`font-black tabular-nums text-black/70 ${big ? "text-xl" : "text-sm"}`}>{r.score.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
      {mine && mine.rank > 3 && (
        <div className={`flex items-center gap-2 rounded-full bg-amber-400/15 border border-amber-400/50 font-bold ${big ? "px-5 py-2 text-xl" : "px-4 py-1.5 text-base"}`}>
          <span className="text-amber-300">{solo ? "You" : "Your team"}</span>
          <span className="text-white">#{mine.rank}</span>
          <span className="text-slate-300 tabular-nums">{mine.score.toLocaleString()}</span>
          {mine.points > 0 && <span className="text-emerald-300 tabular-nums">+{mine.points.toLocaleString()}</span>}
        </div>
      )}
    </div>
  );
}
