/**
 * Most questions are multiple choice; every third one (Q3, Q6, Q9…) is an
 * open answer the team types, so the game keeps a little challenge.
 */
export function isOpenQuestion(orderIndex: number) {
  return orderIndex % 3 === 2;
}

/**
 * The choices in a fixed, scrambled order: the same for everyone in the
 * game (seeded by the question id), but the right answer isn't always in
 * the same spot.
 */
export function shuffledChoices(choices: string[], seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const out = [...choices];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
