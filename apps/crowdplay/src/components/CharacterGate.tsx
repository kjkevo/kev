"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { AvatarPicker } from "@/components/AvatarPicker";
import type { AvatarOption } from "@/hooks/useAvatars";

/**
 * Shown when this phone has no character yet: every game needs one, so
 * it offers the free characters first, with the premium ones one tap away.
 */
export function CharacterGate({
  avatars,
  onPick,
  onBuy,
}: {
  avatars: AvatarOption[];
  onPick: (id: string) => void;
  onBuy?: (avatar: AvatarOption) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const free = avatars.filter((a) => a.priceCents === 0);
  const owned = avatars.filter((a) => a.owned && a.priceCents > 0);
  const starters = [...owned, ...free];
  if (avatars.length === 0) return null;
  return (
    <div className="w-full rounded-2xl bg-amber-400/10 border border-amber-400/40 p-4 text-left">
      <p className="text-lg font-black">Pick your character</p>
      <p className="text-sm text-slate-300 mt-0.5">
        {owned.length === 0 ? "Free to start:" : "Needed to play."}
      </p>
      <div className="grid grid-cols-2 gap-3 mt-3">
        {starters.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onPick(a.id)}
            className="flex flex-col items-center gap-1 rounded-xl bg-white/5 border border-white/10 pt-3 pb-2 active:scale-95 transition"
          >
            <Avatar emoji={a.emoji} imageUrl={a.imageUrl} size={112} variant="full" />
            <span className="text-sm font-bold">{a.name}</span>
            <span className="rounded-full bg-amber-400 text-black text-xs font-bold px-3 leading-6">
              {a.priceCents === 0 ? "Free · Choose" : "Yours · Choose"}
            </span>
          </button>
        ))}
      </div>
      {onBuy && (
        <button type="button" onClick={() => setShowAll(!showAll)} className="text-xs font-bold text-amber-300 mt-3">
          {showAll ? "Hide premium characters" : "Or unlock a premium character ▸"}
        </button>
      )}
      {onBuy && showAll && (
        <div className="mt-2">
          <AvatarPicker avatars={avatars.filter((a) => !a.owned)} selectedId={null} onSelect={onPick} onBuy={onBuy} />
        </div>
      )}
    </div>
  );
}

