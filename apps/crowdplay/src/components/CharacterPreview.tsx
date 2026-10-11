"use client";

import { useState } from "react";
import { EmoteCharacter, EmoteButtons, type EmotePlay } from "@/components/EmoteCharacter";
import { formatPrice } from "@/components/AvatarPicker";
import { emotesFor } from "@/lib/emotes";
import type { AvatarOption } from "@/hooks/useAvatars";

/**
 * A close-up of one character (tap a character anywhere you pick one):
 * the full figure large, its emote if it has one, and Equip (or Unlock).
 */
export function CharacterPreview({
  avatar,
  equipped,
  onEquip,
  onBuy,
  onClose,
  equipLabel = "Equip",
}: {
  avatar: AvatarOption;
  equipped: boolean;
  onEquip: () => void;
  onBuy?: () => void;
  onClose: () => void;
  equipLabel?: string;
}) {
  const [play, setPlay] = useState<EmotePlay | null>(null);
  const locked = !avatar.owned;
  // Wide emotes (arms out, floor moves) must fit the screen: shrink the figure if needed.
  const widest = Math.max(0, ...emotesFor(avatar.id).map((e) => e.aspect * (1 + (e.headroom ?? 0) + (e.footroom ?? 0))));
  const size = Math.round(Math.min(300, widest > 0 ? 340 / widest : 300));
  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/95 backdrop-blur-sm flex items-center justify-center px-6" onClick={onClose}>
      <div className="w-full max-w-sm flex flex-col items-center gap-3 text-white" onClick={(e) => e.stopPropagation()}>
        <p className="text-2xl font-black">{avatar.name}</p>
        <EmoteCharacter
          avatarId={avatar.id}
          emoji={avatar.emoji}
          imageUrl={avatar.imageUrl}
          size={size}
          play={play}
        />
        <EmoteButtons avatarId={avatar.id} onPlay={(id) => setPlay((p) => ({ emoteId: id, n: (p?.n ?? 0) + 1 }))} />
        <div className="flex gap-2 w-full mt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-2xl bg-white/10 py-3 font-bold active:scale-95 transition">
            Back
          </button>
          {locked ? (
            <button
              type="button"
              onClick={onBuy}
              className="flex-1 rounded-2xl bg-amber-400 text-black py-3 font-black active:scale-95 transition"
            >
              Unlock · {formatPrice(avatar.priceCents)}
            </button>
          ) : (
            <button
              type="button"
              onClick={onEquip}
              disabled={equipped}
              className="flex-1 rounded-2xl bg-amber-400 text-black py-3 font-black disabled:opacity-60 active:scale-95 transition"
            >
              {equipped ? "Equipped ✓" : equipLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
