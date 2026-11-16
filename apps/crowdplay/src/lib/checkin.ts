"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { deviceKey } from "@/lib/device";
import { stableKey } from "@/lib/venue";

/**
 * Play only at the bar (migration 0123). Scanning the bar TV's code checks
 * this phone in there; 20 minutes with no taps or answers ends it. Time in
 * a game's lobby or a game in progress counts as active.
 */

export async function checkIn(venue: string, code: string) {
  const { data } = await supabase.rpc("check_in", { p_venue: venue, p_code: code, p_device_key: deviceKey() });
  return data === true;
}

export async function passStatus() {
  const { data } = await supabase.rpc("pass_status", { p_device_key: deviceKey() });
  const r = data?.[0];
  return { valid: !!r?.o_valid, venue: r?.o_venue ?? null, hadPass: !!r?.o_had_pass };
}

export async function touchPass() {
  const { data } = await supabase.rpc("touch_pass", { p_device_key: deviceKey() });
  return data === true;
}

/** This TV's key (the same one the screen's heartbeat uses). */
export function screenKey() {
  return stableKey("crowdplay_screen_key");
}

/** Game pages call this: true while in a lobby or a game in progress (keeps the check-in alive). */
export function useInGame(active: boolean) {
  useEffect(() => {
    document.body.dataset.inGame = active ? "1" : "";
    return () => {
      document.body.dataset.inGame = "";
    };
  }, [active]);
}

/**
 * On the bar's TV: today's check-in code, or null if this screen isn't
 * paired yet. Opening the TV page once with the bar's private setup link
 * (?pair=...) pairs it for good.
 */
export function useScreenCheckin(venue: string | null) {
  const [code, setCode] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!venue) return;
    let cancelled = false;
    const load = () =>
      supabase.rpc("get_checkin_code", { p_venue: venue, p_screen_key: screenKey() }).then(({ data }) => {
        if (!cancelled) setCode((data as string | null) ?? null);
      });
    const pair = new URLSearchParams(window.location.search).get("pair");
    if (pair) supabase.rpc("pair_screen", { p_venue: venue, p_screen_key: screenKey(), p_secret: pair }).then(() => load());
    else load();
    // The code changes once a day; check again now and then.
    const t = setInterval(load, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [venue]);
  return code;
}

/** A link that checks the phone in at this bar, then goes to `next`. */
export function checkinUrl(origin: string, venue: string, code: string, next?: string) {
  const q = new URLSearchParams({ v: venue, c: code });
  if (next) q.set("next", next);
  return `${origin}/in?${q}`;
}
