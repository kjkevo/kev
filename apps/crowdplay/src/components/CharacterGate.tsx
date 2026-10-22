"use client";

import { useState } from "react";
import { formatPrice } from "@/components/AvatarPicker";
import { CharacterCarousel } from "@/components/CharacterCarousel";
import { CharacterPreview } from "@/components/CharacterPreview";
import type { AvatarOption } from "@/hooks/useAvatars";

/**
 * Shown when this phone has no character yet: every game needs one, so
 * it shows them all on a carousel to choose from.
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
  const [viewing, setViewing] = useState<AvatarOption | null>(null);
  if (avatars.length === 0) return null;
  return (
    <div className="w-full rounded-2xl bg-amber-400/10 border border-amber-400/40 p-4 text-left">
      <p className="text-lg font-black text-center">Pick your character</p>
      <div className="mt-3">
        <CharacterCarousel
          avatars={avatars}
          selectedId={null}
          buttonLabel={(a) => (a.owned ? "Choose" : `Unlock · ${formatPrice(a.priceCents)}`)}
          onButton={(a) => (a.owned ? onPick(a.id) : onBuy?.(a))}
          onView={setViewing}
        />
      </div>
      {viewing && (
        <CharacterPreview
          avatar={viewing}
          equipped={false}
          equipLabel="Choose"
          onEquip={() => {
            onPick(viewing.id);
            setViewing(null);
          }}
          onBuy={() => {
            onBuy?.(viewing);
            setViewing(null);
          }}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
