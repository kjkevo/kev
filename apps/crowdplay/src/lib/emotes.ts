/**
 * Character emotes: short animations (transparent animated WebP) a player
 * can trigger in the lobby and during questions. One per character for now
 * (room for up to 4 later).
 * Each file is the character on a transparent background, feet at the
 * bottom, in a box `aspect` wide for every 1 tall. `headroom` is extra
 * space above the standing figure (for jumps) that may rise above its box;
 * `footroom` is space below the feet for floor moves.
 */
export type Emote = {
  id: string;
  label: string;
  src: string;
  durationMs: number;
  aspect: number; // width / height of the file
  headroom?: number; // empty space above the standing figure, as a share of its height
  footroom?: number; // space below the standing feet (moves on the floor), may hang below its box
};

export const MAX_EMOTES = 4;

export const EMOTES: Record<string, Emote[]> = {
  "crystal-titan": [
    { id: "breakdance", label: "Break dance", src: "/emotes/crystal-titan-breakdance.webp", durationMs: 120 * 83, aspect: 452 / 423, footroom: 23 / 400 },
  ],
  "jungle-scout": [
    { id: "finger-guns", label: "Finger guns", src: "/emotes/jungle-scout-finger-guns.webp", durationMs: 120 * 83, aspect: 207 / 400 },
  ],
  "alien-buddy": [
    { id: "scheming", label: "Scheming", src: "/emotes/alien-buddy-scheming.webp", durationMs: 120 * 83, aspect: 235 / 400 },
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
