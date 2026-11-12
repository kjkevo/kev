"use client";

import { usePathname } from "next/navigation";
import { POWERS_LIVE, powerFor } from "@/lib/powers";
import { SB_CHAR_POWERS } from "@/lib/slimpseBingo";
import { WM_CHAR_POWERS } from "@/lib/wildMatch";
import { DL_CHAR_POWERS } from "@/lib/dropLine";

// Which power each character has in each game (matches sb_/wm_/dl_char_power).
const BINGO_KEY: Record<string, string> = {
  "jungle-scout": "trailblaze", "crystal-titan": "catchup", "alien-buddy": "probe", "forest-guardian": "rebuild",
  "stone-golem": "secondwind", "void-walker": "rift", "sylvan-entity": "overgrowth", "geo-sphinx": "riddle", "model-z": "overclock",
};
const CARD_KEY: Record<string, string> = {
  "jungle-scout": "trailblaze", "crystal-titan": "shield", "alien-buddy": "probe", "forest-guardian": "patience",
  "sylvan-entity": "bloom", "geo-sphinx": "riddle", "void-walker": "rift", "model-z": "overclock", "stone-golem": "secondwind",
};

/** The character's power in the game this page belongs to (Trivia anywhere else). */
export function gamePowerFor(avatarId: string, path: string | null): { name: string; how: string; ready?: { after: number; label: string } } | null {
  if (path?.startsWith("/bingo")) return SB_CHAR_POWERS[BINGO_KEY[avatarId]] ?? null;
  if (path?.startsWith("/wild-match")) return WM_CHAR_POWERS[CARD_KEY[avatarId]] ?? null;
  if (path?.startsWith("/drop-line")) return DL_CHAR_POWERS[CARD_KEY[avatarId]] ?? null;
  return powerFor(avatarId);
}

/** A character's power-up and how it works, shown under the character. */
export function PowerCard({ avatarId, className = "" }: { avatarId: string; className?: string }) {
  const power = gamePowerFor(avatarId, usePathname());
  if (!power) return null;
  return (
    <div className={`w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-left ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg font-black text-amber-300">{power.name}</span>
        {!POWERS_LIVE && <span className="ml-auto text-xs font-bold text-white/60">Coming soon</span>}
      </div>
      <p className="mt-0.5 text-base text-white">{power.how}</p>
      {power.ready && <p className="mt-0.5 text-sm font-bold text-sky-200">{power.ready.label}</p>}
    </div>
  );
}
