"use client";

import { Avatar } from "@/components/Avatar";
import { EmoteCharacter, type EmotePlay } from "@/components/EmoteCharacter";

export type CharacterMood = "idle" | "hop" | "cheer" | "slump";

/**
 * The player's character, full body, standing still. It only moves when the
 * player plays an emote. An optional speech bubble sits above it.
 */
export function CharacterBuddy({
  emoji,
  imageUrl,
  mood,
  size = 104,
  says,
  avatarId,
  play,
}: {
  emoji?: string | null;
  imageUrl?: string | null;
  mood: CharacterMood;
  size?: number;
  says?: string;
  /** With an emote play request, the character performs it. */
  avatarId?: string | null;
  play?: EmotePlay | null;
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
        {/* Characters stand still; they only move when the player taps the
            emote (disco ball) button. `mood` is kept for callers but no
            longer animates. */}
        <div data-mood={mood}>
          {avatarId !== undefined ? (
            <EmoteCharacter avatarId={avatarId} emoji={emoji} imageUrl={imageUrl} size={size} play={play} />
          ) : (
            <Avatar emoji={emoji} imageUrl={imageUrl} size={size} variant="full" />
          )}
        </div>
      </div>
    </div>
  );
}
