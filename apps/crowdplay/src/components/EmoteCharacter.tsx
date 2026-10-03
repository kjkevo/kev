"use client";

/* eslint-disable @next/next/no-img-element -- emote animations are animated WebP */

import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { emotesFor, loadEmote, type Emote } from "@/lib/emotes";

/** A play request: which emote, and a counter so the same one can replay. */
export type EmotePlay = { emoteId: string; n: number };

/**
 * A character's full figure that plays an emote animation when `play`
 * changes, then goes back to the still picture. Characters without that
 * emote just stay still.
 */
export function EmoteCharacter({
  avatarId,
  emoji,
  imageUrl,
  size,
  play,
  className = "",
}: {
  avatarId?: string | null;
  emoji?: string | null;
  imageUrl?: string | null;
  size: number;
  play?: EmotePlay | null;
  className?: string;
}) {
  const [running, setRunning] = useState<{ url: string; emote: Emote } | null>(null);

  // Download this character's emotes ahead of time so the first tap is instant.
  useEffect(() => {
    emotesFor(avatarId).forEach((e) => loadEmote(e.src));
  }, [avatarId]);

  useEffect(() => {
    if (!play) return;
    const emote = emotesFor(avatarId).find((e) => e.id === play.emoteId);
    if (!emote) return;
    let url: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    loadEmote(emote.src).then((blob) => {
      if (cancelled || !blob) return;
      url = URL.createObjectURL(blob);
      setRunning({ url, emote });
      timer = setTimeout(() => setRunning(null), emote.durationMs);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [play, avatarId]);

  return (
    <span className={`relative inline-flex items-end justify-center ${className}`} style={{ width: size, height: size }}>
      {running ? (
        <img
          src={running.url}
          alt=""
          className="absolute bottom-0 left-1/2 -translate-x-1/2 max-w-none object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)]"
          style={{ height: size, width: size * running.emote.aspect }}
        />
      ) : (
        <Avatar emoji={emoji} imageUrl={imageUrl} size={size} variant="full" />
      )}
    </span>
  );
}

/** One button per emote this character has (none: nothing shown). */
export function EmoteButtons({
  avatarId,
  onPlay,
  small = false,
}: {
  avatarId?: string | null;
  onPlay: (emoteId: string) => void;
  small?: boolean;
}) {
  const emotes = emotesFor(avatarId);
  if (emotes.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {emotes.map((e) => (
        <button
          key={e.id}
          type="button"
          onClick={() => onPlay(e.id)}
          className={`rounded-full bg-amber-400 text-black font-black shadow active:scale-95 transition ${
            small ? "px-2.5 py-0.5 text-[11px]" : "px-5 py-2 text-sm"
          }`}
        >
          {e.label}
        </button>
      ))}
    </div>
  );
}
