"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DEFAULT_VENUE, rememberPlayerVenue, stableKey } from "@/lib/venue";

// Screens that sit on a TV or the host's laptop aren't guests arriving.
const DISPLAY_PAGES = ["/screen", "/feud/screen", "/bingo/screen", "/qr", "/host"];

/**
 * Counts every guest who arrives, once per phone per visit: through a tagged
 * QR link (?src=qr&venue=<slug>, counted as a scan) or any other way (an old
 * QR, a shared link, typing the address; counted as a visit). The session key
 * is the same one the check-in page uses, so nothing is double counted. The
 * QR tag is then dropped from the address bar so a refresh or a shared link
 * doesn't look like another scan.
 */
export function ArrivalTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (DISPLAY_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    const url = new URL(window.location.href);
    const fromQr = url.searchParams.get("src") === "qr";
    // The check-in page logs its own scan.
    if (pathname.startsWith("/checkin")) return;

    let venue = url.searchParams.get("venue");
    if (venue) rememberPlayerVenue(venue);
    else {
      try {
        venue = localStorage.getItem("crowdplay_venue");
      } catch {
        venue = null;
      }
    }

    const sessionKey = stableKey("crowdplay_scan_session", "session");
    let alreadyCounted = false;
    try {
      alreadyCounted = sessionStorage.getItem("crowdplay_arrival_logged") === sessionKey;
    } catch {
      // storage blocked: log anyway, the server ignores repeats
    }
    if (!alreadyCounted || fromQr) {
      supabase
        .rpc("log_qr_scan", { p_venue: venue || DEFAULT_VENUE, p_session_key: sessionKey, p_source: fromQr ? "qr" : "visit" })
        .then(({ error }) => {
          if (error) {
            console.warn("Couldn't count this arrival", error.message);
            return;
          }
          try {
            sessionStorage.setItem("crowdplay_arrival_logged", sessionKey);
          } catch {
            // fine
          }
        });
    }

    if (fromQr) {
      url.searchParams.delete("src");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
  }, [pathname]);
  return null;
}
