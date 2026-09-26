"use client";

import { useMemo, useState } from "react";
import type { Player, Team } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import type { AvatarOption } from "@/hooks/useAvatars";

export const MAX_TEAMS = 8;
export const MAX_TEAM_SIZE = 5;
export const MIN_TEAM_SIZE = 2;

/** Teams that have at least one player still in the room, largest first. */
export function useLiveTeams(players: Player[], teams: Team[]) {
  return useMemo(() => {
    const active = players.filter((p) => !p.left_at);
    return teams
      .map((t) => ({ team: t, members: active.filter((p) => p.team_id === t.id) }))
      .filter((t) => t.members.length > 0);
  }, [players, teams]);
}

/**
 * Who's in the game before it starts: every team and its members, plus how
 * many of the 8 team spots are taken. Shown anywhere someone is deciding
 * whether (or how) to join, and in the lobby itself.
 */
export function LobbyRoster({
  players,
  teams,
  highlightTeamId,
  avatars,
  title = "Who's in",
  collapsible = false,
}: {
  players: Player[];
  teams: Team[];
  highlightTeamId?: string | null;
  avatars?: Record<string, AvatarOption>;
  title?: string;
  /** Start folded to a one-line "N teams · M players" summary. */
  collapsible?: boolean;
}) {
  const live = useLiveTeams(players, teams);
  const playerCount = live.reduce((n, t) => n + t.members.length, 0);
  const [open, setOpen] = useState(!collapsible);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full max-w-sm rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-slate-300 flex items-center justify-between active:scale-[0.98] transition"
      >
        <span>
          {live.length} team{live.length === 1 ? "" : "s"} · {playerCount} player{playerCount === 1 ? "" : "s"}
        </span>
        <span className="text-indigo-300 text-xs font-bold">Show ▾</span>
      </button>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white/5 border border-white/10 p-4 text-left">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs uppercase tracking-widest text-indigo-300">{title}</p>
        <p className="text-xs text-slate-400">
          {playerCount} player{playerCount === 1 ? "" : "s"} · {live.length}/{MAX_TEAMS} teams
          {collapsible && (
            <button type="button" onClick={() => setOpen(false)} className="ml-2 text-indigo-300 font-bold">
              Hide ▴
            </button>
          )}
        </p>
      </div>
      {live.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-2">Nobody yet. Be the first team in.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {live.map(({ team, members }) => (
            <div
              key={team.id}
              className={`rounded-xl px-3 py-2 ${team.id === highlightTeamId ? "bg-amber-400/20 border border-amber-400/40" : "bg-white/5"}`}
            >
              <p className="text-sm font-bold flex items-center justify-between gap-2">
                <span className="truncate">{team.name}</span>
                <span className="font-normal text-slate-400 shrink-0">
                  {members.length}/{MAX_TEAM_SIZE}
                </span>
              </p>
              {avatars ? (
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-1">
                  {members.map((p) => {
                    const a = p.avatar_id ? avatars[p.avatar_id] : undefined;
                    return (
                      <span key={p.id} className="flex items-center gap-1.5 text-sm text-slate-200">
                        <Avatar emoji={a?.emoji} imageUrl={a?.imageUrl} size={30} />
                        {p.nickname}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-300">{members.map((p) => p.nickname).join(", ")}</p>
              )}
            </div>
          ))}
        </div>
      )}
      {live.length >= MAX_TEAMS && (
        <p className="text-xs text-amber-300/80 mt-3 text-center">All {MAX_TEAMS} team spots are taken. New players join a team with room.</p>
      )}
    </div>
  );
}
