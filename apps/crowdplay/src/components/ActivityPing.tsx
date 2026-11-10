"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DEFAULT_VENUE } from "@/lib/venue";
import { deviceKey } from "@/lib/device";
import { announceProgress } from "@/lib/progress";

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
 * is on) and wake the moment a player page pings. It also keeps a guest's
 * progress alive: unsaved progress resets after 4 hours away.
 */
export function ActivityPing() {
  const pathname = usePathname();
  useEffect(() => {
    if (DISPLAY_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    let first = true;
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      supabase.rpc("touch_activity", { p_venue: currentVenue() }).then(() => {});
      // Keeps a guest's level alive; guests away 4+ hours start over at Level 1.
      supabase.rpc("progress_touch", { p_device_key: deviceKey() }).then(() => {
        // The first ping may have just reset an expired guest: refresh what's on screen.
        if (first) announceProgress();
        first = false;
      });
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
