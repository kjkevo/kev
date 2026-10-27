/**
 * Each character's power-up, shown wherever a character is picked.
 * Every power can be used once per game. Powers are not playable yet:
 * flip POWERS_LIVE once the game supports them to drop the "Coming soon" tag.
 */
export const POWERS_LIVE = false;

export type Power = { icon: string; name: string; how: string };

export const POWERS: Record<string, Power> = {
  "jungle-scout": { icon: "🌿", name: "Trailblaze", how: "Removes one wrong answer from the choices." },
  "crystal-titan": { icon: "💎", name: "Crystal Shield", how: "Blocks the next fog another team throws at you." },
  "alien-buddy": { icon: "🛸", name: "Mind Probe", how: "Shows the room's most popular answer so far. It might not be right!" },
  "forest-guardian": { icon: "🛡️", name: "Guardian", how: "One wrong answer won't break your streak." },
  "sylvan-entity": { icon: "🌸", name: "Time Bloom", how: "Adds 5 seconds to your clock." },
  "geo-sphinx": { icon: "🔮", name: "Riddle Sight", how: "See the clue hint right away." },
  "void-walker": { icon: "🌀", name: "Vanish", how: "Hides your team's score from the TV until the final reveal." },
  "model-z": { icon: "⚡", name: "Overclock", how: "Double points on one question. Turn it on before you answer." },
  "stone-golem": { icon: "🪨", name: "Second Wind", how: "Missed it? Get one more guess for half points." },
};

export function powerFor(avatarId: string | null | undefined): Power | null {
  return avatarId ? POWERS[avatarId] ?? null : null;
}
