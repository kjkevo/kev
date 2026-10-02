"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";

/**
 * Your character waiting in the lobby, with an Emote button. The first
 * emote is a hop: crouch, stretch up into the jump, squash on landing,
 * wobble back. The shadow on the floor shrinks while it's in the air.
 */
export function LobbyStage({ name, emoji, imageUrl }: { name: string; emoji?: string | null; imageUrl?: string | null }) {
  // Bumped on every tap so the animation restarts even mid-hop.
  const [hops, setHops] = useState(0);
  const hopping = hops > 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex flex-col items-center justify-end h-56 w-full">
        <div
          key={hops}
          className={`relative z-10 origin-bottom ${hopping ? "emote-hop" : "char-idle"}`}
          onAnimationEnd={() => setHops(0)}
        >
          <Avatar emoji={emoji} imageUrl={imageUrl} size={170} variant="full" />
        </div>
        <span
          key={`shadow-${hops}`}
          aria-hidden="true"
          className={`-mt-4 h-4 w-28 rounded-[50%] bg-black/45 blur-[3px] ${hopping ? "emote-hop-shadow" : ""}`}
        />
      </div>
      <p className="mt-1 text-sm font-bold text-slate-200">{name}</p>
      <button
        type="button"
        onClick={() => setHops((n) => n + 1)}
        className="mt-2 rounded-full bg-amber-400 text-black font-black px-6 py-2 text-sm shadow-lg shadow-amber-400/20 active:scale-95 transition"
      >
        Emote
      </button>
    </div>
  );
}
