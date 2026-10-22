"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import type { AvatarOption } from "@/hooks/useAvatars";

/**
 * One character at a time, big, with arrows (or a swipe) to the next.
 * Tapping the figure opens its close-up; the button under it picks it.
 */
export function CharacterCarousel({
  avatars,
  selectedId,
  buttonLabel,
  onButton,
  onView,
}: {
  avatars: AvatarOption[];
  selectedId: string | null;
  buttonLabel: (a: AvatarOption) => string;
  onButton: (a: AvatarOption) => void;
  onView?: (a: AvatarOption) => void;
}) {
  const start = Math.max(0, avatars.findIndex((a) => a.id === selectedId));
  const [i, setI] = useState(start);
  const touchX = useRef<number | null>(null);
  useEffect(() => {
    if (i >= avatars.length) setI(0);
  }, [avatars.length, i]);
  if (avatars.length === 0) return null;
  const a = avatars[Math.min(i, avatars.length - 1)];
  const go = (d: number) => setI((n) => (n + d + avatars.length) % avatars.length);
  const selected = a.id === selectedId;
  const locked = !a.owned;
  return (
    <div className="w-full flex flex-col items-center gap-2">
      <div
        className="w-full flex items-center justify-between"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
      >
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous character"
          className="w-11 h-11 shrink-0 rounded-full bg-white/10 text-2xl font-black active:scale-90 transition"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => onView?.(a)}
          aria-label={`See ${a.name} up close`}
          className="flex flex-col items-center gap-1 active:scale-95 transition"
        >
          <Avatar
            key={a.id}
            emoji={a.emoji}
            imageUrl={a.imageUrl}
            size={190}
            variant="full"
            className={`animate-[fade-in_0.2s_ease-out] ${locked ? "opacity-60" : ""}`}
          />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next character"
          className="w-11 h-11 shrink-0 rounded-full bg-white/10 text-2xl font-black active:scale-90 transition"
        >
          ›
        </button>
      </div>
      <p className="text-lg font-black">{a.name}</p>
      <button
        type="button"
        onClick={() => onButton(a)}
        disabled={selected}
        className="rounded-full bg-amber-400 text-black text-sm font-black px-6 py-2 disabled:opacity-70 active:scale-95 transition"
      >
        {buttonLabel(a)}
      </button>
      <div className="flex gap-1.5 mt-1" aria-hidden="true">
        {avatars.map((x, n) => (
          <span key={x.id} className={`h-1.5 rounded-full transition-all ${n === i ? "w-4 bg-amber-400" : "w-1.5 bg-white/25"}`} />
        ))}
      </div>
    </div>
  );
}
