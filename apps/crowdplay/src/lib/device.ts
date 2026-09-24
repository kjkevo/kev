import { stableKey } from "@/lib/venue";

/**
 * This phone's permanent id. Premium avatars are unlocked against it, so
 * they stay unlocked across nights and games on the same phone (and are
 * lost if the browser's site data is cleared).
 */
export function deviceKey() {
  return stableKey("crowdplay_device", "local");
}

const AVATAR_PICK_KEY = "crowdplay_avatar";

/** The avatar this phone last picked, reused when joining the next game. */
export function rememberedAvatar(): string | null {
  try {
    return localStorage.getItem(AVATAR_PICK_KEY);
  } catch {
    return null;
  }
}

export function rememberAvatar(id: string) {
  try {
    localStorage.setItem(AVATAR_PICK_KEY, id);
  } catch {
    // storage blocked: they just pick again next time
  }
}
