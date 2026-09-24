"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { DEFAULT_VENUE, rememberPlayerVenue, stableKey } from "@/lib/venue";

/**
 * Counts people who arrive by scanning a venue QR code (links carry
 * ?src=qr&venue=<slug>). One scan per phone per visit: the session key is
 * the same one the check-in page uses, so the two never double count.
 * The tag is then dropped from the address bar so a refresh or a shared
 * link doesn't look like another scan.
 */
export function ArrivalTracker() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("src") !== "qr" || url.pathname.startsWith("/checkin")) return;
    const venue = url.searchParams.get("venue") || DEFAULT_VENUE;
    rememberPlayerVenue(venue);
    supabase
      .rpc("log_qr_scan", { p_venue: venue, p_session_key: stableKey("crowdplay_scan_session", "session") })
      .then(({ error }) => {
        if (error) console.warn("Couldn't count this QR scan", error.message);
      });
    url.searchParams.delete("src");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
  return null;
}
