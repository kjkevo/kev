"use client";

import { useEffect, useState } from "react";
import { EmoteCharacter, type EmotePlay } from "@/components/EmoteCharacter";
import { emotesFor } from "@/lib/emotes";

/** A streak to celebrate: how many right in a row, and a counter so each one shows once. */
export type Streak = { count: number; n: number };

/**
 * "🔥 3 in a row!": your character pops in at the lower left and does its
 * emote. Teammates see it too (with their own character), since the streak
 * belongs to the team. Stays on screen across the reveal and scores.
 */
export function StreakMoment({
  streak,
  avatarId,
  emoji,
  imageUrl,
  team,
}: {
  streak: Streak | null;
  avatarId?: string | null;
  emoji?: string | null;
  imageUrl?: string | null;
  team: boolean;
}) {
  const [shown, setShown] = useState<Streak | null>(null);
  const [play, setPlay] = useState<EmotePlay | null>(null);

  useEffect(() => {
    if (!streak) return;
    setShown(streak);
    setPlay(null);
    const emote = emotesFor(avatarId)[0];
    // Start the emote just after the card appears (a play present at mount is ignored).
    const start = emote ? setTimeout(() => setPlay({ emoteId: emote.id, n: streak.n }), 250) : undefined;
    const hide = setTimeout(() => setShown(null), Math.max(5000, (emote?.durationMs ?? 0) + 600));
    return () => {
      if (start) clearTimeout(start);
      clearTimeout(hide);
    };
  }, [streak, avatarId]);

  if (!shown) return null;
  return (
    <div className="fixed left-3 bottom-20 z-40 pointer-events-none animate-pop-in">
      <div className="flex items-end gap-2 rounded-2xl bg-gradient-to-br from-orange-500/90 to-rose-600/90 border border-orange-300/70 shadow-xl shadow-orange-500/30 pl-1 pr-3 pt-1 pb-2">
        <EmoteCharacter key={shown.n} avatarId={avatarId} emoji={emoji} imageUrl={imageUrl} size={84} play={play} />
        <div className="pb-1 text-left">
          <p className="text-xl font-black leading-tight">🔥 {shown.count} in a row!</p>
          <p className="text-xs font-bold text-orange-100">{team ? "Your team is on fire" : "You're on fire"}</p>
        </div>
      </div>
    </div>
  );
}
