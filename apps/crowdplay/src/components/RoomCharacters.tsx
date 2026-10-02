"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import type { AvatarOption } from "@/hooks/useAvatars";
import type { QuestionReveal } from "@/hooks/useQuestionReveal";
import type { Player, Team } from "@/lib/types";

type Props = {
  players: Player[];
  avatars: Record<string, AvatarOption>;
  myId?: string;
  myTeamId?: string | null;
  big?: boolean; // the venue TV
};

/** Everyone playing (on a team, still here), grouped by team. */
function usePlaying(players: Player[], teams?: Team[]) {
  return useMemo(() => {
    const order = new Map((teams ?? []).map((t, i) => [t.id, i]));
    return players
      .filter((p) => !p.left_at && p.team_id)
      .sort((a, b) => (order.get(a.team_id!) ?? 0) - (order.get(b.team_id!) ?? 0));
  }, [players, teams]);
}

/**
 * Lock-in pop: every player's character, greyed out while they think, and
 * popping in the moment they lock in an answer (the answer stays hidden).
 */
export function LockInStrip({ players, teams, avatars, answered, myId, myTeamId, big = false }: Props & {
  teams?: Team[];
  answered: Set<string>;
}) {
  const playing = usePlaying(players, teams);
  if (playing.length === 0) return null;
  const done = playing.filter((p) => answered.has(p.id)).length;
  const size = big ? 56 : 30;
  return (
    <div className="w-full">
      <p className={`text-center font-bold uppercase tracking-widest text-slate-400 mb-2 ${big ? "text-lg" : "text-[11px]"}`}>
        Locked in <span className="text-emerald-300">{done}</span>/{playing.length}
      </p>
      <div className={`flex flex-wrap justify-center ${big ? "gap-3" : "gap-1.5"}`}>
        {playing.map((p) => {
          const a = p.avatar_id ? avatars[p.avatar_id] : undefined;
          const isIn = answered.has(p.id);
          const mine = p.team_id === myTeamId;
          return (
            <span key={p.id} className="relative flex flex-col items-center" title={p.nickname}>
              {/* key flips when they lock in, so the landing animation plays */}
              <span
                key={isIn ? "in" : "out"}
                className={`rounded-full ${isIn ? "char-land" : "opacity-35 grayscale"} ${
                  mine ? "ring-2 ring-amber-400" : ""
                }`}
              >
                <Avatar emoji={a?.emoji} imageUrl={a?.imageUrl} size={size} />
              </span>
              {isIn && (
                <span
                  className={`absolute -bottom-0.5 -right-0.5 rounded-full bg-emerald-400 text-black font-black flex items-center justify-center ${
                    big ? "w-5 h-5 text-xs" : "w-3.5 h-3.5 text-[8px]"
                  }`}
                >
                  ✓
                </span>
              )}
              {(big || p.id === myId) && (
                <span className={`truncate text-center text-slate-300 ${big ? "text-sm w-16" : "text-[9px] w-8"}`}>
                  {p.id === myId ? "You" : p.nickname}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

const SETTLE_MS = 1400;

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Pick-your-corner reveal: every character stands on the answer they
 * picked. After a beat the right answer lights up, its characters cheer,
 * and everyone else drops off their corner.
 */
export function PickYourCorner({ reveal, players, teams, avatars, myId, myTeamId, big = false }: Props & {
  reveal: QuestionReveal;
  teams: Team[];
}) {
  const playing = usePlaying(players, teams);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, []);

  const corners = useMemo(() => {
    const byPlayer = new Map(reveal.picks.map((r) => [r.playerId, r]));
    const groups = new Map<string, { key: string; label: string; correct: boolean; people: Player[] }>();
    for (const p of playing) {
      const pick = byPlayer.get(p.id);
      const key = pick?.group ?? "__none";
      const g = groups.get(key) ?? {
        key,
        label: key === "__none" ? "No answer" : key === "correct" ? reveal.correctAnswer : capitalize(pick?.label ?? "?"),
        correct: key === "correct",
        people: [],
      };
      g.people.push(p);
      groups.set(key, g);
    }
    const list = Array.from(groups.values());
    // Right answer first, then the most popular wrong ones, "No answer" last.
    return list.sort((a, b) =>
      a.correct !== b.correct ? (a.correct ? -1 : 1)
        : (a.key === "__none") !== (b.key === "__none") ? (a.key === "__none" ? 1 : -1)
          : b.people.length - a.people.length
    );
  }, [playing, reveal]);

  const myTeamPick = reveal.picks.find((r) => r.teamId === myTeamId);
  const size = big ? 64 : 40;

  return (
    <div className="w-full flex flex-col gap-3">
      <div className={`text-center transition-opacity duration-500 ${settled ? "opacity-100" : "opacity-0"}`}>
        <p className={`uppercase tracking-widest text-slate-400 ${big ? "text-lg" : "text-xs"}`}>Answer</p>
        <p className={`font-black text-emerald-300 break-words ${big ? "text-5xl" : "text-3xl"}`}>{reveal.correctAnswer}</p>
        {myTeamId && myTeamPick && (
          <p className={`mt-1 font-bold ${myTeamPick.teamCorrect ? "text-emerald-300" : "text-rose-300"}`}>
            {myTeamPick.teamCorrect ? "Your team got it ✓" : "Your team missed it"}
          </p>
        )}
      </div>

      <div className={`grid gap-2 ${big ? "grid-cols-3 gap-4" : "grid-cols-2"}`}>
        {corners.map((c) => {
          const state = !settled ? "idle" : c.correct ? "right" : "wrong";
          const none = c.key === "__none";
          return (
            <div
              key={c.key}
              className={`rounded-2xl border p-2.5 transition-colors duration-500 ${
                state === "right"
                  ? "bg-emerald-500/20 border-emerald-400/70"
                  : state === "wrong"
                    ? "bg-rose-500/10 border-rose-400/30"
                    : "bg-white/5 border-white/15"
              } ${c.correct && corners.length > 1 && !big ? "col-span-2" : ""}`}
            >
              <p className={`font-bold truncate ${big ? "text-2xl" : "text-sm"} ${state === "wrong" && !none ? "text-rose-200/80 line-through decoration-rose-400/60" : ""}`}>
                {c.label}
              </p>
              <p className={`text-slate-400 ${big ? "text-base" : "text-[11px]"}`}>
                {c.people.length} {c.people.length === 1 ? "pick" : "picks"}
              </p>
              <div className={`flex flex-wrap ${big ? "gap-3 pt-8" : "gap-1.5 pt-6"} min-h-[2.5rem] overflow-hidden pb-1 -mt-4`}>
                {c.people.map((p, i) => {
                  const a = p.avatar_id ? avatars[p.avatar_id] : undefined;
                  return (
                    <span key={p.id} className="flex flex-col items-center" style={{ width: size + 8 }}>
                      <span
                        className={state === "right" ? "char-cheer" : state === "wrong" ? "char-drop" : "char-idle"}
                        style={{ animationDelay: state === "idle" ? undefined : `${(i % 6) * 90}ms` }}
                      >
                        <Avatar emoji={a?.emoji} imageUrl={a?.imageUrl} size={size} variant="full" />
                      </span>
                      <span
                        className={`truncate w-full text-center ${big ? "text-sm" : "text-[10px]"} ${
                          p.id === myId ? "font-black text-amber-300" : p.team_id === myTeamId ? "text-amber-200/80" : "text-slate-300"
                        }`}
                      >
                        {p.id === myId ? "You" : p.nickname}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
