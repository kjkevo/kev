"use client";

import { useEffect, useMemo, useState } from "react";
import { EmoteCharacter, type EmotePlay } from "@/components/EmoteCharacter";
import { emotesFor } from "@/lib/emotes";
import type { AvatarOption } from "@/hooks/useAvatars";
import type { Player, Team } from "@/lib/types";

const PLACE: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd" };
const BLOCK: Record<number, string> = {
  1: "bg-gradient-to-b from-amber-300 to-amber-500 text-black",
  2: "bg-gradient-to-b from-slate-200 to-slate-400 text-black",
  3: "bg-gradient-to-b from-orange-300 to-orange-600 text-black",
};
const HEIGHT: Record<number, [number, number]> = { 1: [128, 224], 2: [96, 176], 3: [80, 144] };
// Where each place stands, left to right: 2nd, 1st, 3rd.
const SLOT: Record<number, number> = { 2: 0, 1: 1, 3: 2 };
const GLOW: Record<number, string> = { 1: "rgba(251,191,36,0.55)", 2: "rgba(226,232,240,0.45)", 3: "rgba(251,146,60,0.45)" };

type Stage = "hidden" | "enter" | "center" | "placed";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * The end-of-game podium, revealed 3rd, 2nd, then 1st. Each podium zips into
 * the middle of the screen, zoomed in with a glow, and its player (or whole
 * team) plays an emote; then it zips to its place (2nd left, 1st middle,
 * 3rd right). Podiums already placed wait in the background, dimmed, until
 * the last one lands. 1st place gets a drumroll beat first. Solo players
 * show their own name; teams show the team name.
 */
export function PodiumCeremony({
  top,
  players,
  avatars,
  myTeamId,
  big = false,
  onReveal,
  onSuspense,
  onDone,
}: {
  /** The top teams in order: 1st, 2nd, 3rd (fewer if fewer played). */
  top: Team[];
  players: Player[];
  avatars: Record<string, AvatarOption>;
  myTeamId?: string | null;
  big?: boolean;
  /** A podium arrives in the middle (for sounds). */
  onReveal?: (rank: number) => void;
  /** The beat before 1st place. */
  onSuspense?: () => void;
  onDone?: () => void;
}) {
  const ranks = useMemo(() => top.map((_, i) => i + 1), [top]);
  const [stages, setStages] = useState<Record<number, Stage>>({});
  const [plays, setPlays] = useState<Record<string, EmotePlay>>({});
  const [suspense, setSuspense] = useState(false);

  const membersOf = (team: Team) => {
    const onTeam = players.filter((p) => p.team_id === team.id);
    const here = onTeam.filter((p) => !p.left_at);
    return (here.length > 0 ? here : onTeam).slice(0, 4);
  };

  // The show runs once per set of top teams.
  const key = top.map((t) => t.id).join(",");
  useEffect(() => {
    if (top.length === 0) return;
    let cancelled = false;
    const set = (rank: number, s: Stage) => setStages((prev) => ({ ...prev, [rank]: s }));
    (async () => {
      await sleep(800);
      for (const rank of [...ranks].reverse()) {
        if (cancelled) return;
        if (rank === 1 && ranks.length > 1) {
          setSuspense(true);
          onSuspense?.();
          await sleep(2400);
          if (cancelled) return;
          setSuspense(false);
        }
        set(rank, "enter");
        await sleep(60);
        if (cancelled) return;
        set(rank, "center");
        onReveal?.(rank);
        await sleep(650);
        if (cancelled) return;
        // Everyone on this podium emotes at once.
        const team = top[rank - 1];
        setPlays((prev) => {
          const next = { ...prev };
          for (const p of membersOf(team)) {
            const emote = emotesFor(p.avatar_id)[0];
            if (emote) next[p.id] = { emoteId: emote.id, n: (prev[p.id]?.n ?? 0) + 1 };
          }
          return next;
        });
        await sleep(rank === 1 ? 4200 : 3600);
        if (cancelled) return;
        set(rank, "placed");
        await sleep(900);
      }
      if (!cancelled) onDone?.();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key stands in for the top teams
  }, [key]);

  const spotlight = ranks.find((r) => stages[r] === "center" || stages[r] === "enter");
  const stageHeight = big ? 470 : 290;

  return (
    <div className={`relative w-full ${big ? "max-w-4xl" : "max-w-sm"}`} style={{ height: stageHeight }}>
      {suspense && (
        <div className="absolute inset-x-0 top-1/3 flex flex-col items-center gap-3 animate-pop-in">
          <p className={`uppercase tracking-widest text-slate-300 ${big ? "text-2xl" : "text-sm"}`}>And in 1st place…</p>
          <div className="flex gap-1.5">
            {[0, 150, 300].map((d) => (
              <span key={d} className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-suspense-pulse" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        </div>
      )}
      {ranks.map((rank) => {
        const stage = stages[rank] ?? "hidden";
        if (stage === "hidden") return null;
        const team = top[rank - 1];
        const members = membersOf(team);
        const slot = ranks.length === 1 ? 1 : SLOT[rank];
        const dx = (1 - slot) * 100; // % of a column: from its slot to the middle
        const transform =
          stage === "enter"
            ? `translate(${dx}%, -30%) scale(0.2)`
            : stage === "center"
              ? `translate(${dx}%, -12%) scale(${big ? 1.35 : 1.45})`
              : "translate(0, 0) scale(1)";
        const inBackground = stage === "placed" && spotlight !== undefined;
        const mine = team.id === myTeamId;
        const size = Math.round((big ? 96 : 50) * (rank === 1 ? 1.15 : 1));
        const name = members.length === 1 ? members[0].nickname : team.name;
        return (
          <div
            key={rank}
            className="absolute bottom-0 flex flex-col items-center"
            style={{
              left: `${slot * (100 / 3)}%`,
              width: `${100 / 3}%`,
              transform,
              transformOrigin: "50% 100%",
              opacity: stage === "enter" ? 0 : inBackground ? 0.45 : 1,
              filter: inBackground ? "saturate(0.6)" : "none",
              zIndex: stage === "center" || stage === "enter" ? 20 : 10 - rank,
              transition: "transform 700ms cubic-bezier(0.2, 0.9, 0.3, 1.15), opacity 450ms ease, filter 450ms ease",
            }}
          >
            {/* The spotlight glow while it's in the middle. */}
            {stage === "center" && (
              <div
                className="absolute -inset-x-6 -top-10 bottom-0 -z-10 rounded-full blur-2xl animate-pop-in"
                style={{ background: `radial-gradient(circle at 50% 40%, ${GLOW[rank]}, transparent 70%)` }}
              />
            )}
            <div className={`flex justify-center ${big ? "-space-x-6" : "-space-x-3"}`}>
              {members.map((p) => {
                const a = p.avatar_id ? avatars[p.avatar_id] : undefined;
                return <EmoteCharacter key={p.id} avatarId={p.avatar_id} emoji={a?.emoji} imageUrl={a?.imageUrl} size={size} play={plays[p.id]} />;
              })}
            </div>
            <div
              className={`w-full rounded-t-xl flex flex-col items-center gap-0.5 px-1 pt-1.5 ${BLOCK[rank]} ${mine ? "ring-4 ring-white/80" : ""}`}
              style={{ height: HEIGHT[rank][big ? 1 : 0] }}
            >
              <span className={`font-black ${big ? "text-4xl" : "text-xl"}`}>{PLACE[rank]}</span>
              <span className={`font-black text-center leading-tight line-clamp-2 break-words max-w-full ${big ? "text-2xl" : "text-xs"}`}>
                {mine && !big && members.length === 1 ? "You" : name}
              </span>
              <span className={`font-black tabular-nums text-black/70 ${big ? "text-xl" : "text-xs"}`}>{team.score.toLocaleString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
