"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { supabase } from "@/lib/supabase";
import { deviceKey } from "@/lib/device";
import { usePlayerVenue } from "@/lib/venue";

type Row = {
  rank: number;
  name: string;
  emoji: string | null;
  imageUrl: string | null;
  xp: number;
  wins: number;
  isMe: boolean;
};

/**
 * This week's top players around here (the bar's area, e.g. Chicago), or at
 * just this bar. Ranked by XP earned this week; resets every Monday.
 */
export function Leaderboard() {
  const venue = usePlayerVenue();
  const atBar = !!venue && venue !== "main";
  const [scope, setScope] = useState<"area" | "bar">("area");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [area, setArea] = useState("Chicago");

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      supabase
        .rpc("get_leaderboard", { p_venue: venue ?? "main", p_scope: scope, p_device_key: deviceKey() })
        .then(({ data }) => {
          if (cancelled || !data) return;
          if (data[0]) setArea(data[0].o_area);
          setRows(
            data.map((r) => ({
              rank: r.o_rank,
              name: r.o_name,
              emoji: r.o_emoji,
              imageUrl: r.o_image_url,
              xp: r.o_xp,
              wins: r.o_wins,
              isMe: r.o_is_me,
            }))
          );
        });
    load();
    window.addEventListener("slimpse:progress", load);
    return () => {
      cancelled = true;
      window.removeEventListener("slimpse:progress", load);
    };
  }, [venue, scope]);

  if (rows === null) return null;
  const medal = (n: number) => (n === 1 ? "🥇" : n === 2 ? "🥈" : n === 3 ? "🥉" : `${n}`);

  return (
    <div className="w-full rounded-3xl bg-white/[0.06] border border-white/15 px-4 py-3 text-left">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-300">This week</p>
          <p className="text-lg font-black leading-tight">Top players</p>
        </div>
        {atBar ? (
          <div className="flex rounded-full bg-black/30 p-0.5 text-xs font-bold">
            {(["area", "bar"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`rounded-full px-3 py-1 ${scope === s ? "bg-amber-400 text-black" : "text-slate-300"}`}
              >
                {s === "area" ? area : "This bar"}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-xs font-bold text-slate-400">{area}</span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 mb-1 text-sm text-slate-300 text-center">Nobody yet this week. Play a game to take #1!</p>
      ) : (
        <ol className="mt-2 flex flex-col gap-1">
          {rows.map((r) => (
            <li
              key={`${r.rank}-${r.name}`}
              className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${r.isMe ? "bg-amber-400/20 ring-1 ring-amber-400/60" : ""}`}
            >
              <span className="w-7 text-center text-sm font-black tabular-nums">{medal(r.rank)}</span>
              <Avatar emoji={r.emoji} imageUrl={r.imageUrl} size={30} />
              <span className="flex-1 min-w-0 truncate text-sm font-bold">
                {r.name}
                {r.isMe && <span className="text-amber-300"> (you)</span>}
              </span>
              <span className="text-sm font-black tabular-nums text-amber-300">{r.xp.toLocaleString()} XP</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-center text-[11px] text-slate-500">Resets every Monday</p>
    </div>
  );
}
