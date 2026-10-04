/**
 * Character emotes: short animations (transparent animated WebP) a player
 * can trigger in the lobby and during questions. Up to 4 per character.
 * Each file is the character on a transparent background, feet at the
 * bottom, in a box `aspect` wide for every 1 tall. `headroom` is extra
 * space above the standing figure (for jumps) that may rise above its box.
 */
export type Emote = {
  id: string;
  label: string;
  src: string;
  durationMs: number;
  aspect: number; // width / height of the file
  headroom?: number; // empty space above the standing figure, as a share of its height
};

export const MAX_EMOTES = 4;

export const EMOTES: Record<string, Emote[]> = {
  "crystal-titan": [
    { id: "jump", label: "Jump", src: "/emotes/crystal-titan-jump.webp", durationMs: 96 * 66, aspect: 288 / 456, headroom: 56 / 400 },
    { id: "disappointed", label: "Disappointed", src: "/emotes/crystal-titan-disappointed.webp", durationMs: 120 * 83, aspect: 288 / 400 },
    { id: "flex", label: "Flex", src: "/emotes/crystal-titan-flex.webp", durationMs: 120 * 83, aspect: 368 / 400 },
    { id: "think", label: "Think", src: "/emotes/crystal-titan-think.webp", durationMs: 120 * 83, aspect: 288 / 400 },
  ],
};

export function emotesFor(avatarId: string | null | undefined): Emote[] {
  return (avatarId && EMOTES[avatarId]?.slice(0, MAX_EMOTES)) || [];
}

// The Emote button plays a character's emotes in order, one per tap, then
// starts over (remembered while the page is open, across lobby and game).
const nextIndex = new Map<string, number>();
export function nextEmote(avatarId: string | null | undefined): Emote | null {
  const list = emotesFor(avatarId);
  if (!avatarId || list.length === 0) return null;
  const i = (nextIndex.get(avatarId) ?? 0) % list.length;
  nextIndex.set(avatarId, i + 1);
  return list[i];
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
