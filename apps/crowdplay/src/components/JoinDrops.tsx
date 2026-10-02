"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import type { AvatarOption } from "@/hooks/useAvatars";
import type { Player, Team } from "@/lib/types";

type Drop = { key: string; nickname: string; team: string; emoji?: string | null; imageUrl?: string | null };

const SHOW_MS = 4500;
const MAX_SHOWN = 3;

/**
 * Entrance: whenever someone joins, their character drops in at the top of
 * the screen ("Plucky Wombat joined Quizzly Bears"), so the room sees
 * people arriving. Players already in when the page opens don't drop.
 */
export function JoinDrops({
  players,
  teams,
  avatars,
  excludeId,
  big = false,
}: {
  players: Player[];
  teams: Team[];
  avatars: Record<string, AvatarOption>;
  excludeId?: string;
  big?: boolean;
}) {
  const seen = useRef<Set<string> | null>(null);
  const [drops, setDrops] = useState<Drop[]>([]);

  useEffect(() => {
    const active = players.filter((p) => !p.left_at);
    if (seen.current === null) {
      // First load: everyone here already counts as seen.
      if (players.length === 0) return;
      seen.current = new Set(active.map((p) => p.id));
      return;
    }
    const fresh = active.filter((p) => !seen.current!.has(p.id));
    if (fresh.length === 0) return;
    fresh.forEach((p) => seen.current!.add(p.id));
    const added = fresh
      .filter((p) => p.id !== excludeId)
      .map((p) => {
        const a = p.avatar_id ? avatars[p.avatar_id] : undefined;
        return {
          key: `${p.id}-${Date.now()}`,
          nickname: p.nickname,
          team: teams.find((t) => t.id === p.team_id)?.name ?? "the game",
          emoji: a?.emoji,
          imageUrl: a?.imageUrl,
        };
      });
    if (added.length === 0) return;
    setDrops((prev) => [...added, ...prev].slice(0, MAX_SHOWN));
    const keys = new Set(added.map((d) => d.key));
    setTimeout(() => setDrops((prev) => prev.filter((d) => !keys.has(d.key))), SHOW_MS);
  }, [players, teams, avatars, excludeId]);

  if (drops.length === 0) return null;
  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-40 flex flex-col items-center pointer-events-none ${
        big ? "top-6 gap-3" : "top-16 gap-2"
      }`}
      aria-live="polite"
    >
      {drops.map((d) => (
        <div
          key={d.key}
          className={`join-drop flex items-center rounded-full bg-indigo-950/95 border border-amber-400/50 shadow-xl text-white whitespace-nowrap ${
            big ? "gap-4 pl-2 pr-7 py-2 text-3xl" : "gap-2 pl-1 pr-4 py-1 text-sm"
          }`}
        >
          <Avatar emoji={d.emoji} imageUrl={d.imageUrl} size={big ? 72 : 34} />
          <span>
            <span className="font-black">{d.nickname}</span> joined <span className="font-bold text-amber-300">{d.team}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
