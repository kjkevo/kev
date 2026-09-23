"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { stableKey } from "@/lib/venue";

const HEARTBEAT_MS = 30_000;
const ADS_REFRESH_MS = 5 * 60_000;
const AD_SECONDS = 15;
const AD_GAP_SECONDS = 45;

type Ad = { id: string; name: string; headline: string; tagline: string | null; accent: string };

/**
 * Runs on every venue TV screen:
 * - checks in every 30s so the ops dashboard can tell a dark TV from a quiet night
 * - reports crashes to the error log
 * - rotates the venue's active sponsors along the bottom of the screen, one
 *   at a time (15s on, 45s off), and logs each completed showing as proof of play
 */
export function ScreenAgent({ venue, page }: { venue: string; page: string }) {
  const screenKey = useRef<string>("");
  const [ads, setAds] = useState<Ad[]>([]);
  const [showing, setShowing] = useState<Ad | null>(null);

  useEffect(() => {
    screenKey.current = stableKey("crowdplay_screen_key");
    let cancelled = false;

    const beat = () =>
      supabase
        .rpc("screen_heartbeat", {
          p_venue: venue,
          p_screen_key: screenKey.current,
          p_page: page,
          p_user_agent: navigator.userAgent.slice(0, 200),
        })
        .then(({ error }) => {
          if (error && !cancelled) console.warn("Screen check-in failed", error.message);
        });

    const loadAds = () =>
      supabase.rpc("get_screen_ads", { p_venue: venue }).then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          supabase.rpc("log_client_error", { p_venue: venue, p_source: "ads", p_message: `Couldn't load sponsor ads: ${error.message}` });
          return;
        }
        setAds(
          (data ?? []).map((a) => ({ id: a.o_sponsor_id, name: a.o_name, headline: a.o_headline, tagline: a.o_tagline, accent: a.o_accent }))
        );
      });

    const onError = (event: ErrorEvent) => {
      supabase.rpc("log_client_error", {
        p_venue: venue,
        p_source: "screen",
        p_message: `${page}: ${event.message}`.slice(0, 300),
        p_detail: { file: event.filename, line: event.lineno },
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      supabase.rpc("log_client_error", {
        p_venue: venue,
        p_source: "screen",
        p_message: `${page}: ${String(event.reason)}`.slice(0, 300),
      });
    };

    beat();
    loadAds();
    const beatTimer = setInterval(beat, HEARTBEAT_MS);
    const adsTimer = setInterval(loadAds, ADS_REFRESH_MS);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      cancelled = true;
      clearInterval(beatTimer);
      clearInterval(adsTimer);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [venue, page]);

  // Rotation: show the next sponsor, then log the play once it has been on
  // screen for the full slot.
  useEffect(() => {
    if (ads.length === 0) {
      setShowing(null);
      return;
    }
    let index = 0;
    let hideTimer: ReturnType<typeof setTimeout>;
    const showNext = () => {
      const ad = ads[index % ads.length];
      index += 1;
      setShowing(ad);
      hideTimer = setTimeout(() => {
        setShowing(null);
        if (document.visibilityState === "visible") {
          supabase.rpc("log_ad_play", {
            p_venue: venue,
            p_screen_key: screenKey.current,
            p_sponsor_id: ad.id,
            p_seconds: AD_SECONDS,
          });
        }
      }, AD_SECONDS * 1000);
    };
    const first = setTimeout(showNext, 5000);
    const loop = setInterval(showNext, (AD_SECONDS + AD_GAP_SECONDS) * 1000);
    return () => {
      clearTimeout(first);
      clearTimeout(hideTimer);
      clearInterval(loop);
    };
  }, [ads, venue]);

  if (!showing) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-6 pb-4 pointer-events-none">
      <div
        className="mx-auto max-w-4xl flex items-center gap-4 rounded-2xl bg-slate-900/95 border px-6 py-3 shadow-2xl"
        style={{ borderColor: showing.accent }}
      >
        <span className="text-xs uppercase tracking-widest text-slate-400 shrink-0">Tonight&apos;s sponsor</span>
        <span className="w-px self-stretch bg-white/10" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-2xl font-black truncate" style={{ color: showing.accent }}>
            {showing.headline}
          </p>
          <p className="text-slate-300 truncate">
            {showing.name}
            {showing.tagline ? ` · ${showing.tagline}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
