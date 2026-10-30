"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
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
 * Who has locked in, with a progress bar: every other team (your own team's
 * answers are shown above it on the phone). In solo play everyone else is a
 * row of small faces, no names; in team play each other team is its name,
 * ticked once all of it has answered. The TV shows everyone that way.
 */
export function LockInStrip({ players, teams, avatars, answered, myTeamId, big = false }: Props & {
  teams?: Team[];
  answered: Set<string>;
}) {
  const playing = usePlaying(players, teams);
  if (playing.length === 0) return null;
  const otherTeams = (teams ?? [])
    .filter((t) => t.id !== myTeamId)
    .map((t) => {
      const members = playing.filter((p) => p.team_id === t.id);
      return { team: t, members, done: members.length > 0 && members.every((p) => answered.has(p.id)) };
    })
    .filter((t) => t.members.length > 0);
  const label = `uppercase tracking-widest font-bold text-slate-400 ${big ? "text-lg" : "text-[11px]"}`;
  // Solo play: everyone else is one player, shown as a row of small faces.
  const soloRoom = otherTeams.every((t) => t.members.length === 1);
  const doneCount = otherTeams.filter((t) => t.done).length;

  return (
    <div className="w-full flex flex-col gap-3">
      {otherTeams.length > 0 && (
        <div>
          <p className={`flex items-center justify-center gap-1.5 mb-2 ${label}`}>
            <Icon name="check" size={big ? 20 : 13} className="text-emerald-300" />
            {soloRoom ? "Players" : "Teams"} <span className="text-emerald-300">{doneCount}</span>/{otherTeams.length}
          </p>
          <div className={`mx-auto mb-2 h-1.5 rounded-full bg-white/10 overflow-hidden ${big ? "w-96" : "w-48"}`}>
            <div
              className="h-full rounded-full bg-emerald-400 transition-all duration-500"
              style={{ width: `${(doneCount / otherTeams.length) * 100}%` }}
            />
          </div>
          {soloRoom ? (
            <div className={`flex flex-wrap justify-center ${big ? "gap-2" : "gap-1"}`}>
              {otherTeams.map(({ team, members, done }) => {
                const p = members[0];
                const a = p.avatar_id ? avatars[p.avatar_id] : undefined;
                return (
                  <span key={team.id} title={p.nickname} className="relative">
                    <span key={done ? "in" : "out"} className={`block rounded-full ${done ? "char-land" : "opacity-35 grayscale"}`}>
                      <Avatar emoji={a?.emoji} imageUrl={a?.imageUrl} size={big ? 48 : 26} />
                    </span>
                    {done && (
                      <span className={`absolute -top-0.5 -right-0.5 rounded-full bg-emerald-400 text-black flex items-center justify-center ${big ? "w-5 h-5" : "w-3 h-3"}`}>
                        <Icon name="check" size={big ? 14 : 9} strokeWidth={3.5} />
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          ) : (
          <div className={`flex flex-wrap justify-center ${big ? "gap-3" : "gap-1.5"}`}>
            {otherTeams.map(({ team, done }) => (
              <span
                key={team.id}
                className={`flex items-center gap-2 rounded-full border font-bold ${
                  big ? "px-4 py-2 text-xl" : "px-3 py-1 text-xs"
                } ${done ? "bg-emerald-500/15 border-emerald-400/50 text-emerald-100" : "bg-white/5 border-white/15 text-slate-300"}`}
              >
                {done ? (
                  <span className={`rounded-full bg-emerald-400 text-black font-black flex items-center justify-center ${big ? "w-6 h-6 text-sm" : "w-4 h-4 text-[9px]"}`}>
                    ✓
                  </span>
                ) : (
                  <span aria-hidden="true" className={`rounded-full border-2 border-slate-500 ${big ? "w-5 h-5" : "w-3 h-3"}`} />
                )}
                <span className="truncate max-w-[12rem]">{team.name}</span>
              </span>
            ))}
          </div>
          )}
        </div>
      )}
    </div>
  );
}

const SETTLE_MS = 1400;

/**
 * The phone's big right-or-wrong card after a question: a green check and
 * the points, a red X, or "No answer", with the right answer underneath.
 * Big enough to read at a glance from across the table.
 */
export function RevealVerdict({
  reveal,
  myId,
  myTeamId,
  myPoints,
  compact = false,
}: {
  reveal: QuestionReveal;
  myId: string;
  myTeamId?: string | null;
  myPoints?: number | null;
  compact?: boolean;
}) {
  const myPick = reveal.picks.find((r) => r.playerId === myId);
  const myTeamPick = reveal.picks.find((r) => r.teamId === myTeamId);
  const answered = !!myPick?.label;
  const right = answered && (myTeamPick?.teamCorrect ?? myPick.correct);
  const icon = compact ? 40 : 72;
  return (
    <div
      className={`rounded-3xl flex flex-col items-center text-center animate-pop-in ${compact ? "px-4 py-3" : "px-4 py-5"} ${
        !answered ? "bg-slate-600 text-white" : right ? "bg-emerald-500 text-black" : "bg-rose-600 text-white"
      }`}
    >
      <div className={`flex items-center gap-2 ${compact ? "" : "flex-col"}`}>
        <Icon name={!answered ? "clock" : right ? "check" : "x"} size={icon} strokeWidth={3} />
        <p className={`font-black ${compact ? "text-3xl" : "text-5xl mt-1"}`}>{!answered ? "No answer" : right ? "RIGHT!" : "WRONG"}</p>
        {myPoints != null && myPoints > 0 && (
          <p className={`font-black ${compact ? "text-2xl ml-1" : "text-3xl mt-1"}`}>+{myPoints.toLocaleString()}</p>
        )}
      </div>
      <p className={`font-bold opacity-90 ${compact ? "text-base mt-1" : "text-lg mt-2"}`}>
        Answer: <span className="font-black">{reveal.correctAnswer}</span>
      </p>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Pick-your-corner reveal: every character stands on the answer they
 * picked. After a beat the right answer's corner turns green and the
 * others red. The characters stand still.
 */
export function PickYourCorner({ reveal, players, teams, avatars, myId, myTeamId, myPoints, big = false }: Props & {
  reveal: QuestionReveal;
  teams: Team[];
  /** What your team just scored (the phone's big right/wrong card). */
  myPoints?: number | null;
}) {
  const playing = usePlaying(players, teams);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, []);

  // Only the people who got it right are shown; wrong answers stay private.
  const rightPeople = useMemo(() => {
    const correct = new Set(reveal.picks.filter((r) => r.group === "correct").map((r) => r.playerId));
    return playing.filter((p) => correct.has(p.id));
  }, [playing, reveal]);

  // Team play (any team has 2+ players): show the teams that got it right,
  // not every character; your own team first.
  const teamPlay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of playing) counts.set(p.team_id!, (counts.get(p.team_id!) ?? 0) + 1);
    return Array.from(counts.values()).some((n) => n > 1);
  }, [playing]);
  const rightTeams = useMemo(() => {
    const ids = new Set(reveal.picks.filter((r) => r.teamCorrect).map((r) => r.teamId));
    return (teams ?? []).filter((t) => ids.has(t.id)).sort((a, b) => (a.id === myTeamId ? -1 : b.id === myTeamId ? 1 : 0));
  }, [reveal, teams, myTeamId]);

  const myTeamPick = reveal.picks.find((r) => r.teamId === myTeamId);
  const myPick = reveal.picks.find((r) => r.playerId === myId);
  const size = big ? 96 : 80;

  return (
    <div className="w-full flex flex-col gap-3">
      {/* On a phone: one big, unmissable verdict first. */}
      {myId && settled && <RevealVerdict reveal={reveal} myId={myId} myTeamId={myTeamId} myPoints={myPoints} />}

      <div className={`text-center transition-opacity duration-500 ${settled ? "opacity-100" : "opacity-0"} ${myId ? "hidden" : ""}`}>
        <p className={`uppercase tracking-widest text-slate-400 ${big ? "text-lg" : "text-xs"}`}>Answer</p>
        <p className={`font-black text-emerald-300 break-words ${big ? "text-5xl" : "text-3xl"}`}>{reveal.correctAnswer}</p>
        {myTeamId && myTeamPick && (
          <p className={`mt-1 font-bold ${myTeamPick.teamCorrect ? "text-emerald-300" : "text-rose-300"}`}>
            {myTeamPick.teamCorrect ? "Your team got it ✓" : "Your team missed it"}
          </p>
        )}
        {myId && (
          <p className="mt-0.5 text-sm text-slate-300">
            {!myPick?.label
              ? "You didn't answer this one"
              : <>You said <span className="font-bold text-white">{capitalize(myPick.label)}</span> {myPick.correct ? "✓" : "✗"}</>}
          </p>
        )}
      </div>

      <div
        className={`rounded-2xl border p-2.5 transition-opacity duration-500 bg-emerald-500/20 border-emerald-400/70 ${
          settled ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className={`font-bold break-words text-emerald-200 ${big ? "text-3xl" : "text-lg"}`}>{reveal.correctAnswer}</p>
        {teamPlay ? (
          <>
            <p className={`flex items-center gap-1.5 text-emerald-100/80 ${big ? "text-lg" : "text-sm"}`}>
              <Icon name="check" size={big ? 20 : 15} />
              {rightTeams.length === 0
                ? "No team got this one"
                : `${rightTeams.length} team${rightTeams.length === 1 ? "" : "s"} got it right`}
            </p>
            {rightTeams.length > 0 && (
              <div className={`flex flex-wrap ${big ? "gap-3" : "gap-2"} pt-2 pb-1`}>
                {rightTeams.map((t) => (
                  <span
                    key={t.id}
                    className={`flex items-center gap-1.5 rounded-full font-bold ${big ? "px-5 py-2 text-2xl" : "px-3 py-1.5 text-base"} ${
                      t.id === myTeamId ? "bg-amber-400 text-black" : "bg-emerald-400/20 border border-emerald-400/50 text-emerald-50"
                    }`}
                  >
                    <Icon name="users" size={big ? 22 : 16} />
                    {t.id === myTeamId ? `${t.name} (you)` : t.name}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className={`flex items-center gap-1.5 text-emerald-100/80 ${big ? "text-lg" : "text-sm"}`}>
            <Icon name="check" size={big ? 20 : 15} />
            {rightPeople.length === 0 ? "Nobody got this one" : `${rightPeople.length} got it right`}
          </p>
        )}
        {!teamPlay && rightPeople.length > 0 && (
          <div className={`flex flex-wrap ${big ? "gap-3" : "gap-2"} pt-2 pb-1`}>
            {rightPeople.map((p) => {
              const a = p.avatar_id ? avatars[p.avatar_id] : undefined;
              return (
                <span key={p.id} className="flex flex-col items-center" style={{ width: size + 8 }}>
                  <Avatar emoji={a?.emoji} imageUrl={a?.imageUrl} size={size} variant="full" />
                  <span
                    className={`truncate w-full text-center ${big ? "text-xl" : "text-base"} ${
                      p.id === myId ? "font-black text-amber-300" : p.team_id === myTeamId ? "text-amber-200/80" : "text-slate-300"
                    }`}
                  >
                    {p.id === myId ? "You" : p.nickname}
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
