// Shared trivia types + the MVP scoring rule. No imports so this is safe to use
// from both server and client code.

export type SessionPhase = "lobby" | "question" | "reveal" | "ended";

export interface Venue {
  id: string;
  name: string;
  address: string | null;
  qr_token: string;
  active_session_id: string | null;
}

export interface Session {
  id: string;
  venue_id: string;
  game_type: string;
  phase: SessionPhase;
  current_question_index: number;
  current_question_id: string | null;
  question_started_at: string | null;
  started_at: string | null;
  ended_at: string | null;
}

export interface LeaderboardRow {
  player_id: string;
  display_name: string;
  score: number;
}

// The question shape sent to players — deliberately WITHOUT correct_index while
// a question is open. correct_index is only included once the session reveals.
export interface PublicQuestion {
  id: string;
  prompt: string;
  choices: string[];
  category: string | null;
  index: number; // position in the bank (session.current_question_index)
  correct_index: number | null; // null until phase === "reveal"
}

// MVP scoring: correct answers earn more the faster they land.
export const MAX_POINTS = 1000;
export const MIN_POINTS = 500;
const PENALTY_PER_SECOND = 25;
const MAX_SECONDS = 20;

export function scoreForAnswer(
  isCorrect: boolean,
  questionStartedAt: string | null,
  answeredAt: Date = new Date(),
): number {
  if (!isCorrect) return 0;
  if (!questionStartedAt) return MAX_POINTS;
  const elapsedSec = Math.min(
    MAX_SECONDS,
    Math.max(0, (answeredAt.getTime() - new Date(questionStartedAt).getTime()) / 1000),
  );
  return Math.max(MIN_POINTS, MAX_POINTS - Math.floor(elapsedSec * PENALTY_PER_SECOND));
}
