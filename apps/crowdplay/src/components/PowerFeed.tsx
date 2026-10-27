"use client";

import { Avatar } from "@/components/Avatar";
import { powerByKey, powerPublicLine } from "@/lib/powers";
import type { RoomPower } from "@/hooks/usePowers";

type Who = {
  playerName: (id: string) => string;
  teamName: (id: string) => string;
  /** The character the player is wearing, for the face on each row. */
  face: (playerId: string) => { emoji?: string | null; imageUrl?: string | null } | undefined;
};

/**
 * The powers used on this question, one row each, newest at the bottom:
 * who (face, name, team), which power, and what it does, in plain words.
 * On the TV it sits in its own column so the question never moves.
 */
export function PowerFeed({ powers, who, big = false }: { powers: RoomPower[]; who: Who; big?: boolean }) {
  if (powers.length === 0) return null;
  return (
    <div className={`flex flex-col gap-2 ${big ? "w-[22rem]" : "w-full"}`}>
      <p className={`uppercase tracking-widest text-violet-300 font-bold ${big ? "text-sm" : "text-[11px]"}`}>⚡ Powers this question</p>
      {powers.map((p) => {
        const power = powerByKey(p.power);
        if (!power) return null;
        const face = who.face(p.player_id);
        return (
          <div
            key={p.id}
            className={`flex items-center gap-3 rounded-2xl bg-violet-500/15 border border-violet-400/40 text-left animate-pop-in ${
              big ? "px-3 py-2.5" : "px-2.5 py-2"
            }`}
          >
            <Avatar emoji={face?.emoji} imageUrl={face?.imageUrl} size={big ? 48 : 34} />
            <div className="flex-1 min-w-0">
              <p className={`truncate font-bold text-white ${big ? "text-lg" : "text-sm"}`}>
                {who.playerName(p.player_id)} <span className="font-normal text-slate-400">· {who.teamName(p.team_id)}</span>
              </p>
              <p className={`text-violet-100 ${big ? "text-base" : "text-xs"}`}>
                <span className="font-black">
                  {power.icon} {power.name}:
                </span>{" "}
                {powerPublicLine(p.power, p.amount, p.target_team_id ? who.teamName(p.target_team_id) : undefined)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
