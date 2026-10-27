/**
 * Social Bingo squares: small, friendly things to do with the people around
 * you at a bar. Each is quick and doable in a few minutes, nothing needs a
 * drink, and none puts anyone on the spot. Every card takes 24 of these at
 * random, so no two cards are alike. The same list is loaded into
 * bingo_prompts (migration 0091) for live games.
 */
export const BINGO_PROMPTS = [
  "High-five someone at another table",
  "Learn the bartender's name",
  "Compliment a stranger's outfit",
  "Cheers with someone you just met",
  "Take a selfie with 3 new people",
  "Swap a fun fact with a stranger",
  "Teach someone a secret handshake",
  "Find someone born in your month",
  "Find someone wearing your color",
  "Get a song rec from a stranger",
  "Ask someone their karaoke song",
  "Find someone who's been abroad this year",
  "Learn how a couple here met",
  "Find a fellow lefty",
  "Get someone to show you a dance move",
  "Find someone with your first initial",
  "Start a round of applause",
  "Find someone celebrating tonight",
  "Ask a stranger their dream trip",
  "Find someone from another state",
  "Find someone who plays an instrument",
  "Hear a stranger's best joke",
  "Toast the bartender",
  "Find someone with your star sign",
  "Learn a word in another language",
  "Find someone who's met a celebrity",
  "Get a movie rec from a stranger",
  "Fist-bump 5 different people",
  "Hear the story behind a tattoo",
  "Find someone who can whistle",
  "Guess a stranger's hometown",
  "Rock-paper-scissors a stranger",
  "Find someone here for the first time",
  "Find a regular who knows the menu",
  "Learn someone's go-to order",
  "Get someone to share a hidden talent",
  "Find a fan of your team",
  "Thumb-war someone at another table",
  "Debate pizza toppings with someone",
  "Find someone who can do an accent",
  "Get someone to sing one line",
  "Find an oldest sibling",
  "Find an only child",
  "Find a pet with a funny name",
  "Find someone who's lived in 3+ cities",
  "Hear someone's best travel story",
  "Find someone who's never broken a bone",
  "Get 5 people to cheers at once",
  "Introduce two strangers",
  "Find a birthday this month",
  "Find someone who can do a magic trick",
  "Make a stranger laugh out loud",
  "Find someone who speaks 2 languages",
  "Learn a stranger's middle name",
  "Find someone with your phone brand",
  "Get a local food rec",
  "Find someone with a nickname",
  "Get a stranger to guess your age",
  "Find a pineapple-on-pizza fan",
  "Show someone a photo of your pet",
  "Find someone who saw a concert this year",
  "Learn a stranger's favorite movie",
  "Find someone in the same shoe brand",
  "Find someone from a family of 4+ kids",
  "Find someone who was up for sunrise",
  "Swap weekend plans with a stranger",
  "Find someone with the same favorite snack",
  "Get a stranger to rate your handshake",
] as const;

export const BINGO_FREE = "Free space";

/** A fresh 5x5 card: 24 different squares at random, free space in the middle. */
export function randomBingoCard(rand: () => number = Math.random): string[] {
  const pool = [...BINGO_PROMPTS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picks: string[] = pool.slice(0, 24);
  picks.splice(12, 0, BINGO_FREE);
  return picks;
}

/** The lines on a 5x5 card: 5 rows, 5 columns, 2 diagonals. */
export const BINGO_LINES: number[][] = [
  ...[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => r * 5 + c)),
  ...[0, 1, 2, 3, 4].map((c) => [0, 1, 2, 3, 4].map((r) => r * 5 + c)),
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

/** The first complete line on a card, if any. */
export function bingoLine(marked: boolean[]): number[] | null {
  return BINGO_LINES.find((line) => line.every((i) => marked[i])) ?? null;
}

/** Fewest squares still needed to finish any line. */
export function squaresToBingo(marked: boolean[]): number {
  return Math.min(...BINGO_LINES.map((line) => line.filter((i) => !marked[i]).length));
}
