"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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

const PLAYER_VENUE_KEY = "crowdplay_venue";

/** Remember which venue this phone checked in at, for the game pages. */
export function rememberPlayerVenue(slug: string) {
  try {
    if (SLUG.test(slug)) localStorage.setItem(PLAYER_VENUE_KEY, slug);
  } catch {
    // storage blocked: the game pages fall back to ?venue= or the default
  }
}

/**
 * Which venue's games a phone should see: ?venue= on the link, else the
 * venue it last checked in at, else the default venue.
 */
export function usePlayerVenue() {
  const [venue, setVenue] = useState<string | null>(null);
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("venue")?.toLowerCase() ?? "";
    let chosen = SLUG.test(fromUrl) ? fromUrl : "";
    if (chosen) rememberPlayerVenue(chosen);
    else {
      try {
        chosen = localStorage.getItem(PLAYER_VENUE_KEY) ?? "";
      } catch {
        chosen = "";
      }
    }
    setVenue(SLUG.test(chosen) ? chosen : DEFAULT_VENUE);
  }, []);
  return venue;
}

/**
 * A venue's id from its short code. undefined while loading, null if there's
 * no active venue with that code (then the default venue is used instead,
 * so a stale bookmark still lands in a game).
 */
export function useVenueId(slug: string | null) {
  const [id, setId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    const lookup = async (s: string): Promise<string | null> => {
      const { data } = await supabase.from("venues").select("id").eq("slug", s).eq("active", true).maybeSingle();
      return data?.id ?? null;
    };
    (async () => {
      const found = (await lookup(slug)) ?? (slug !== DEFAULT_VENUE ? await lookup(DEFAULT_VENUE) : null);
      if (!cancelled) setId(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);
  return id;
}
