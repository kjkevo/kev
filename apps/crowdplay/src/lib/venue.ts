"use client";

import { useEffect, useState } from "react";

export const DEFAULT_VENUE = "main";

const SLUG = /^[a-z0-9][a-z0-9-]{1,39}$/;

/**
 * Which venue this TV belongs to. Set once with ?venue=<slug> on the screen
 * URL; the TV remembers it after that, so a reload or a switch between the
 * game screens keeps reporting to the same venue.
 */
export function useScreenVenue() {
  const [venue, setVenue] = useState(DEFAULT_VENUE);
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("venue")?.toLowerCase() ?? "";
    let chosen = SLUG.test(fromUrl) ? fromUrl : "";
    try {
      if (chosen) localStorage.setItem("crowdplay_screen_venue", chosen);
      else chosen = localStorage.getItem("crowdplay_screen_venue") ?? "";
    } catch {
      // storage blocked: fall back to the URL or the default
    }
    setVenue(SLUG.test(chosen) ? chosen : DEFAULT_VENUE);
  }, []);
  return venue;
}

/** A random id this browser keeps, so one physical TV is one screen. */
export function stableKey(storageKey: string, storage: "local" | "session" = "local") {
  const make = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
  try {
    const store = storage === "local" ? localStorage : sessionStorage;
    let key = store.getItem(storageKey);
    if (!key) {
      key = make();
      store.setItem(storageKey, key);
    }
    return key;
  } catch {
    return make();
  }
}

/** Only same-site paths are allowed as a post-check-in destination. */
export function safeNextPath(raw: string | null | undefined) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}
