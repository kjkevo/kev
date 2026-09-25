"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { deviceKey } from "@/lib/device";

export type Season = {
  username: string | null; // this phone's name for the month, once picked
  month: string; // e.g. "September"
  resetsOn: string; // e.g. "October 1"
};

function monthName(isoDate: string, offsetMonths = 0) {
  const [y, m] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + offsetMonths, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
}

/**
 * The monthly trivia season at a venue and this phone's username for it.
 * Usernames and the champion leaderboard reset on the 1st of each month.
 */
export function useSeason(venue: string | null) {
  const [season, setSeason] = useState<Season | null>(null);

  const refresh = useCallback(() => {
    if (!venue) return;
    supabase.rpc("get_season_profile", { p_device_key: deviceKey(), p_venue: venue }).then(({ data }) => {
      const row = data?.[0];
      if (!row) return;
      setSeason({
        username: row.o_username,
        month: monthName(row.o_season_month),
        resetsOn: `${monthName(row.o_season_month, 1)} 1`,
      });
    });
  }, [venue]);

  useEffect(refresh, [refresh]);
  return { season, refresh };
}
