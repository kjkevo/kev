"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { powerScoreTag } from "@/lib/powers";
import type { RoomPower } from "@/hooks/usePowers";
import { EmoteCharacter, type EmotePlay } from "@/components/EmoteCharacter";
import { emotesFor } from "@/lib/emotes";
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

// Who led after the last scores screen, per game (kept while the page is open),
// to spot a lead change.
const lastLeader = new Map<string, string>();

/**
 * The scores after each question: the top 3 on a gold, silver and bronze
 * podium (characters standing on their block, what each just scored above
 * them), and your place if it isn't in the top 3. Solo players show their
 * own name. A power used on
 * the question shows as a tag beside the points, so a doubled (or stolen)
 * score explains itself.
 * Lead change: when a different team takes 1st, its characters do their
 * emote on the gold block, with "Took the lead!" above.
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
  const [newLeader, setNewLeader] = useState<string | null>(null);
  const [leadPlay, setLeadPlay] = useState<EmotePlay | null>(null);
  // One stable play request per character, so re-renders don't restart the emote.
  const plays = useRef(new Map<string, EmotePlay>());
  const playFor = (playerId: string, emoteId: string, n: number) => {
    const key = `${playerId}:${n}`;
    if (!plays.current.has(key)) plays.current.set(key, { emoteId, n });
    return plays.current.get(key)!;
  };

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      supabase.rpc("get_round_standings", { p_room_id: roomId }).then(({ data }) => {
        if (cancelled || !data) return;
        // Places by position, not by the server's tied rank (1st, 1st, 3rd), so
        // there is always a 1st, 2nd and 3rd. The rows come sorted by score,
        // then name, so a tie is settled the same way on every phone and the TV.
        setRows(data.map((r, i) => ({ teamId: r.o_team_id, name: r.o_name, score: r.o_score, points: r.o_points, rank: i + 1 })));
        const leader = data[0]?.o_score > 0 ? data[0].o_team_id : null;
        if (!leader) return;
        const before = lastLeader.get(roomId);
        lastLeader.set(roomId, leader);
        if (before && before !== leader) setNewLeader(leader);
      });
    load();
    // Scores land a moment after the question closes; read again shortly.
    const t = setTimeout(load, 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [roomId, questionIndex]);

  // Start the leaders' emotes once the podium has popped in.
  useEffect(() => {
    if (!newLeader) return;
    const t = setTimeout(() => setLeadPlay({ emoteId: "", n: Date.now() }), 500);
    return () => clearTimeout(t);
  }, [newLeader]);

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
          // A solo player gets one big chest-up frame; a team's players stand
          // side by side in one row, each as their framed face.
          const n = members.length;
          const size = Math.round((n <= 1 ? (big ? 170 : 84) : big ? 110 : 56) * (rank === 1 ? 1.1 : 1));
          const isMine = r.teamId === myTeamId;
          const tookLead = rank === 1 && r.teamId === newLeader;
          return (
            <div
              key={r.teamId}
              className="flex-1 min-w-0 flex flex-col items-center animate-pop-in"
              style={{ animationDelay: `${i * 120}ms`, animationFillMode: "both" }}
            >
              {tookLead && (
                <span
                  className={`mb-1 max-w-full rounded-full bg-amber-400 text-black font-black text-center leading-tight animate-pop-in ${
                    big ? "text-xl px-4 py-1" : "text-[11px] px-2 py-0.5"
                  }`}
                >
                  {isMine ? (members.length > 1 ? "Your team took the lead!" : "You took the lead!") : "Took the lead!"}
                </span>
              )}
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
              {n >= 2 ? (
                <div className="mb-1 w-full flex justify-center gap-0.5 px-0.5">
                  {members.map((p) => {
                    const a = p.avatar_id ? avatars[p.avatar_id] : undefined;
                    const face = a?.imageUrl?.replace(/-256\.png$/, "-icon.png");
                    return (
                      <div
                        key={p.id}
                        className={`flex-1 min-w-0 aspect-square overflow-hidden rounded-lg bg-white/10 ${
                          isMine ? "ring-2 ring-white/80" : "ring-1 ring-white/15"
                        } ${tookLead ? "animate-bounce" : ""}`}
                        style={{ maxWidth: size }}
                      >
                        {face ? (
                          // eslint-disable-next-line @next/next/no-img-element -- small face icon
                          <img src={face} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center text-xl">{a?.emoji ?? ""}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mb-1 flex justify-center">
                  {members.map((p) => {
                    const a = p.avatar_id ? avatars[p.avatar_id] : undefined;
                    // Each character plays its own first emote when its team takes the lead.
                    const emote = emotesFor(p.avatar_id)[0];
                    // Chest up: the full figure scaled up and pinned to the top of a frame.
                    return (
                      <div
                        key={p.id}
                        className={`relative overflow-hidden rounded-xl bg-gradient-to-b from-white/15 to-white/[0.03] ${
                          isMine ? "ring-2 ring-white/80" : "ring-1 ring-white/15"
                        }`}
                        style={{ width: size, height: Math.round(size * 0.9) }}
                      >
                        <div className="absolute left-1/2 top-0 -translate-x-1/2">
                          <EmoteCharacter
                            avatarId={p.avatar_id}
                            emoji={a?.emoji}
                            imageUrl={a?.imageUrl}
                            size={Math.round(size * 2.3)}
                            play={tookLead && leadPlay && emote ? playFor(p.id, emote.id, leadPlay.n) : null}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
