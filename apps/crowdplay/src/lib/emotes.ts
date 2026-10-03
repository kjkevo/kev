/**
 * Character emotes: short animations (transparent animated WebP) a player
 * can trigger in the lobby and during questions. Up to 4 per character.
 * Each file is the character on a transparent background, feet at the
 * bottom, in a box `aspect` wide for every 1 tall.
 */
export type Emote = { id: string; label: string; src: string; durationMs: number; aspect: number };

export const MAX_EMOTES = 4;

export const EMOTES: Record<string, Emote[]> = {
  "crystal-titan": [
    { id: "jump", label: "Jump", src: "/emotes/crystal-titan-jump.webp", durationMs: 96 * 66, aspect: 288 / 400 },
  ],
};

export function emotesFor(avatarId: string | null | undefined): Emote[] {
  return (avatarId && EMOTES[avatarId]?.slice(0, MAX_EMOTES)) || [];
}

// Each play gets a fresh object URL, so the animation always starts from
// its first frame (browsers share playback for the same URL).
const blobs = new Map<string, Promise<Blob | null>>();
export function loadEmote(src: string) {
  if (!blobs.has(src)) {
    blobs.set(
      src,
      fetch(src)
        .then((r) => (r.ok ? r.blob() : null))
        .catch(() => null)
    );
  }
  return blobs.get(src)!;
}
