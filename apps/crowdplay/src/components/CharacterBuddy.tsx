"use client";

import { Avatar } from "@/components/Avatar";

export type CharacterMood = "idle" | "hop" | "cheer" | "slump";

const SPARKLES = [
  { sx: "-46px", sy: "-40px", delay: "0ms" },
  { sx: "44px", sy: "-48px", delay: "250ms" },
  { sx: "-38px", sy: "10px", delay: "500ms" },
  { sx: "40px", sy: "6px", delay: "750ms" },
  { sx: "0px", sy: "-62px", delay: "1000ms" },
];

/**
 * The player's character, full body, reacting to the game: floating while
 * they think, a hop when they vote, cheering when their team locks in or
 * wins, slumping when they come last. A speech bubble says what's up.
 */
export function CharacterBuddy({
  emoji,
  imageUrl,
  mood,
  size = 104,
  says,
}: {
  emoji?: string | null;
  imageUrl?: string | null;
  mood: CharacterMood;
  size?: number;
  says?: string;
}) {
  return (
    <div className="relative flex flex-col items-center" style={{ width: size + 24 }}>
      {says && (
        <div
          key={says}
          className="relative z-10 mb-1 max-w-[9rem] rounded-xl bg-white text-black text-xs font-bold px-2.5 py-1 text-center shadow animate-pop-in"
        >
          {says}
          <span className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-white rotate-45" aria-hidden="true" />
        </div>
      )}
      <div className="relative">
        {/* key restarts the animation each time the mood changes */}
        <div key={mood} className={`char-${mood}`}>
          <Avatar emoji={emoji} imageUrl={imageUrl} size={size} variant="full" />
        </div>
        {mood === "cheer" &&
          SPARKLES.map((s, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="char-sparkle absolute left-1/2 top-1/3 text-amber-300 text-lg pointer-events-none"
              style={{ "--sx": s.sx, "--sy": s.sy, animationDelay: s.delay } as React.CSSProperties}
            >
              ✦
            </span>
          ))}
      </div>
    </div>
  );
}
