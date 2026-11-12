"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * First-time walkthroughs, one per game. They show once per phone, and only
 * to people who came from the main menu (?src=menu). Someone who joins from
 * a game's own QR code goes straight in; playing a game counts as having
 * seen its walkthrough.
 */
export type TutorialGame = "trivia" | "bingo" | "wild-match" | "drop-line";

// Bump to show every walkthrough again on every phone (e.g. for testing).
const TUTORIAL_VERSION = 2;
const key = (g: TutorialGame) => `slimpse_tutorial_done:v${TUTORIAL_VERSION}:${g}`;

export function tutorialSeen(g: TutorialGame) {
  try {
    return localStorage.getItem(key(g)) === "1";
  } catch {
    return true;
  }
}

export function markTutorialSeen(g: TutorialGame) {
  try {
    localStorage.setItem(key(g), "1");
  } catch {
    // storage blocked: nothing to remember
  }
}

/** Show the walkthrough? Only from the main menu, and only the first time. */
export function useFirstTimeTutorial(g: TutorialGame) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const fromMenu = new URLSearchParams(window.location.search).get("src") === "menu";
    if (fromMenu && !tutorialSeen(g)) setShow(true);
  }, [g]);
  const close = useCallback(() => {
    markTutorialSeen(g);
    setShow(false);
  }, [g]);
  return { show, close };
}

/** Call on a game's play page: playing it means they know how. */
export function useMarkTutorialSeen(g: TutorialGame) {
  useEffect(() => markTutorialSeen(g), [g]);
}
