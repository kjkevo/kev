import type { Database } from "./database.types";

export type Room = Database["public"]["Tables"]["rooms"]["Row"];
export type Player = Database["public"]["Tables"]["players"]["Row"];
export type Answer = Database["public"]["Tables"]["answers"]["Row"];

// The generated view type marks every column nullable (Postgres views lose
// not-null info generically), but questions_public mirrors non-null columns
// on public.questions 1:1 whenever a row exists at all. Hand-written here so
// callers don't have to null-check fields that are never actually null.
export type PublicQuestion = {
  id: string;
  pack_id: string;
  order_index: number;
  prompt: string;
  choices: string[];
  time_limit_seconds: number;
};
export type QuestionPack = Database["public"]["Tables"]["question_packs"]["Row"];
export type CategoryVote = Database["public"]["Tables"]["category_votes"]["Row"];

export type Phase = "lobby" | "question" | "reveal" | "leaderboard" | "final";

export type HostCredentials = { roomId: string; hostSecret: string };
export type PlayerCredentials = { playerId: string; clientToken: string; roomId: string };

export const hostKey = (code: string) => `crowdplay_host_${code.toUpperCase()}`;
export const playerKey = (code: string) => `crowdplay_player_${code.toUpperCase()}`;

// --- Family Feud ---

export type FeudRoom = Database["public"]["Tables"]["feud_rooms"]["Row"];
export type FeudPlayer = Database["public"]["Tables"]["feud_players"]["Row"];

export type FeudPhase = "lobby" | "play" | "steal" | "fast_money" | "reveal" | "leaderboard" | "final";
export type FeudTeam = "a" | "b";

export type FeudBoardSlot = { revealed: boolean; text: string | null; points: number | null };
export type FeudLastGuess = { nickname: string; team: FeudTeam; guess: string; matched: boolean };
export type FeudFastMoneyAnswer = {
  player: 1 | 2;
  prompt: string;
  guess: string;
  matched: boolean;
  points: number;
};

export type FeudPlayerCredentials = { playerId: string; clientToken: string; roomId: string; team: FeudTeam };

export const feudPlayerKey = (code: string) => `crowdplay_feud_player_${code.toUpperCase()}`;
