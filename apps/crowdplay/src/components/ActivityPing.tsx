"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DEFAULT_VENUE } from "@/lib/venue";

// Pages that sit on a TV or the host's laptop don't count as someone playing.
const DISPLAY_PAGES = ["/screen", "/feud/screen", "/bingo/screen", "/qr", "/host"];

function currentVenue() {
  const fromUrl = new URLSearchParams(window.location.search).get("venue");
  if (fromUrl) return fromUrl;
  try {
    return localStorage.getItem("crowdplay_venue") || DEFAULT_VENUE;
  } catch {
    return DEFAULT_VENUE;
  }
}

/**
 * Tells the server someone is actually here. Games at a venue go to rest
 * after 20 minutes without this (unless the Automatic Roller Coaster setting
 * is on) and wake the moment a player page pings.
 */
export function ActivityPing() {
  const pathname = usePathname();
  useEffect(() => {
    if (DISPLAY_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      supabase.rpc("touch_activity", { p_venue: currentVenue() }).then(() => {});
    };
    ping();
    const timer = setInterval(ping, 60_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [pathname]);
  return null;
}
