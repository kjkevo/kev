"use client";

import { useState } from "react";
import { CharacterCarousel } from "@/components/CharacterCarousel";
import { CharacterPreview } from "@/components/CharacterPreview";
import type { AvatarOption } from "@/hooks/useAvatars";

export function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/**
 * The characters on a carousel. Tapping one opens a close-up
 * (CharacterPreview); Unlock on a locked one opens the "Unlock Character" screen.
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
  const [viewing, setViewing] = useState<AvatarOption | null>(null);
  if (avatars.length === 0) return null;
  return (
    <div className="w-full max-w-sm">
      <CharacterCarousel
        avatars={avatars}
        selectedId={selectedId}
        buttonLabel={(a) => (a.id === selectedId ? "Equipped ✓" : a.owned ? "Equip" : `Unlock · ${formatPrice(a.priceCents)}`)}
        onButton={(a) => (a.owned ? onSelect(a.id) : onBuy?.(a))}
        onView={setViewing}
      />
      {viewing && (
        <CharacterPreview
          avatar={viewing}
          equipped={viewing.id === selectedId}
          onEquip={() => {
            onSelect(viewing.id);
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
