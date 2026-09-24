"use client";

import { Avatar } from "@/components/Avatar";
import type { AvatarOption } from "@/hooks/useAvatars";

export function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/**
 * Free avatars first, then premium ones with a lock (no price in the grid).
 * Tapping a locked one opens the "Unlock Character" screen, which shows the
 * price (onBuy); everything else just selects.
 */
export function AvatarPicker({
  avatars,
  selectedId,
  onSelect,
  onBuy,
}: {
  avatars: AvatarOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBuy?: (avatar: AvatarOption) => void;
}) {
  if (avatars.length === 0) return null;
  return (
    <div className="w-full max-w-xs">
      <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">Pick your avatar</p>
      <div className="grid grid-cols-4 gap-2">
        {avatars.map((a) => {
          const locked = !a.owned;
          const selected = a.id === selectedId;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => (locked ? onBuy?.(a) : onSelect(a.id))}
              aria-label={locked ? `${a.name}, locked. Tap to unlock` : a.name}
              aria-pressed={selected}
              className={`relative flex flex-col items-center gap-1 rounded-xl py-2 transition active:scale-95 ${
                selected ? "bg-amber-400/25 ring-2 ring-amber-400" : "bg-white/5"
              }`}
            >
              <Avatar emoji={a.emoji} imageUrl={a.imageUrl} size={40} className={locked ? "opacity-60" : ""} />
              <span className="text-[11px] text-slate-300 truncate max-w-full px-1">{a.name}</span>
              {locked && (
                <span aria-hidden="true" className="absolute top-1 right-1 rounded-full bg-black/60 text-[10px] px-1 leading-4">
                  🔒
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
