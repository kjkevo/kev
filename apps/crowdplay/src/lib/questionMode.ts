/**
 * Most questions are multiple choice; every third one (Q3, Q6, Q9…) is an
 * open answer the team types, so the game keeps a little challenge.
 */
export function isOpenQuestion(orderIndex: number) {
  return orderIndex % 3 === 2;
}

/** Seconds on the clock: 20 for multiple choice and for an open answer
 * (matches trivia_question_seconds() in the database). */
export function questionSeconds() {
  return 20;
}

/** This question's setup in the game, as loaded by useCurrentQuestion. */
type Setup = { seconds?: number | null; is_open?: boolean | null } | null | undefined;

/** Seconds on the clock for this question in this game (twists change it: lightning is 8). */
export function secondsFor(q: Setup) {
  return q?.seconds ?? questionSeconds();
}

/** Typed answer? Twist questions are always multiple choice. */
export function isOpenFor(q: Setup, orderIndex: number) {
  return q?.is_open ?? isOpenQuestion(orderIndex);
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
