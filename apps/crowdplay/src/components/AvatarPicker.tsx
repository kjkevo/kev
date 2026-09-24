"use client";

import { Avatar } from "@/components/Avatar";
import type { AvatarOption } from "@/hooks/useAvatars";

export function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/**
 * Free avatars first, then premium ones with a lock (no price in the grid).
 * Every avatar this phone can use (free or bought) has an Equip button;
 * the one in use says Equipped. Locked ones say Unlock and open the
 * "Unlock Character" screen with the price (onBuy).
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
              aria-label={locked ? `Unlock ${a.name}` : selected ? `${a.name}, equipped` : `Equip ${a.name}`}
              aria-pressed={selected}
              className={`relative flex flex-col items-center gap-1 rounded-xl pt-2 pb-1.5 transition active:scale-95 ${
                selected ? "bg-amber-400/25 ring-2 ring-amber-400" : "bg-white/5"
              }`}
            >
              <Avatar emoji={a.emoji} imageUrl={a.imageUrl} size={40} className={locked ? "opacity-60" : ""} />
              <span className="text-[11px] text-slate-300 truncate max-w-full px-1">{a.name}</span>
              <span
                aria-hidden="true"
                className={`rounded-full px-2 text-[10px] font-bold leading-5 ${
                  selected
                    ? "bg-amber-400 text-black"
                    : locked
                      ? "bg-white/10 text-amber-300"
                      : "bg-white/15 text-white"
                }`}
              >
                {selected ? "Equipped ✓" : locked ? "Unlock" : "Equip"}
              </span>
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
