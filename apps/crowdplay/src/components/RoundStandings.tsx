"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { powerScoreTag } from "@/lib/powers";
import type { RoomPower } from "@/hooks/usePowers";

type Standing = { teamId: string; name: string; score: number; points: number; rank: number };

/**
 * The scores after each question: the top 3 teams, with what each just
 * scored, and your team's place if it isn't in the top 3. A power used on
 * the question shows as a tag beside the points, so a doubled (or stolen)
 * score explains itself.
 */
export function RoundStandings({
  roomId,
  questionIndex,
  myTeamId,
  powers = [],
  big = false,
}: {
  roomId: string;
  questionIndex: number;
  myTeamId?: string | null;
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
  const top = rows.slice(0, 3);
  const mine = myTeamId ? rows.find((r) => r.teamId === myTeamId) : undefined;
  const place = ["1st", "2nd", "3rd"];
  const tagsFor = (teamId: string) => [
    ...powers.filter((p) => p.team_id === teamId).map((p) => powerScoreTag(p.power, p.amount, false)),
    ...powers.filter((p) => p.power === "rift" && p.target_team_id === teamId).map((p) => powerScoreTag(p.power, p.amount, true)),
  ];

  const row = (r: Standing, i: number) => (
    <div
      key={r.teamId}
      className={`flex items-center gap-3 rounded-xl px-3 ${big ? "py-3 text-2xl" : "py-3 text-xl"} animate-pop-in ${
        r.teamId === myTeamId ? "bg-amber-400/20 border border-amber-400/50" : "bg-white/5"
      }`}
      style={{ animationDelay: `${i * 120}ms`, animationFillMode: "both" }}
    >
      <span className={`shrink-0 rounded-lg bg-amber-400/20 text-amber-300 font-black text-center ${big ? "text-xl w-14 py-1" : "text-sm w-10 py-0.5"}`}>{place[r.rank - 1] ?? `#${r.rank}`}</span>
      <span className="flex-1 min-w-0 truncate font-bold text-left">{r.name}</span>
      {tagsFor(r.teamId).map((tag) => (
        <span
          key={tag}
          className={`shrink-0 rounded-full bg-violet-500/20 border border-violet-400/50 text-violet-100 font-bold ${big ? "text-base px-3 py-0.5" : "text-xs px-2 py-0.5"}`}
        >
          {tag}
        </span>
      ))}
      {r.points > 0 && <span className="text-emerald-300 font-bold tabular-nums">+{r.points.toLocaleString()}</span>}
      <span className="font-black tabular-nums text-amber-300">{r.score.toLocaleString()}</span>
    </div>
  );

  return (
    <div className={`w-full flex flex-col gap-1.5 ${big ? "max-w-2xl" : ""}`}>
      <p className={`uppercase tracking-widest text-slate-400 ${big ? "text-base" : "text-sm"}`}>Top 3</p>
      {top.map((r, i) => row(r, i))}
      {mine && mine.rank > 3 && (
        <p className={`text-slate-300 ${big ? "text-lg" : "text-base"}`}>
          Your team: #{mine.rank} · {mine.score.toLocaleString()}
          {mine.points > 0 && <span className="text-emerald-300 font-bold"> (+{mine.points.toLocaleString()})</span>}
        </p>
      )}
    </div>
  );
}
