"use client";

/* eslint-disable @next/next/no-img-element -- a bar's logo from any address */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePlayerVenue } from "@/lib/venue";

export type VenueBrand = { name: string; logoUrl: string | null; accent: string | null; welcome: string | null; prize: string | null };

/** A bar's branding (logo, color, welcome line, prize), or null for an unbranded venue. */
export function useVenueBrand(venueSlug?: string | null) {
  const pageVenue = usePlayerVenue();
  const venue = venueSlug ?? pageVenue;
  const [brand, setBrand] = useState<VenueBrand | null>(null);
  useEffect(() => {
    if (!venue) return;
    let cancelled = false;
    supabase.rpc("get_venue_brand", { p_venue: venue }).then(({ data }) => {
      const row = data?.[0];
      if (cancelled) return;
      // Only a bar with something set up gets a banner.
      setBrand(
        row && (row.o_logo_url || row.o_welcome || row.o_prize)
          ? { name: row.o_name, logoUrl: row.o_logo_url, accent: row.o_accent, welcome: row.o_welcome, prize: row.o_prize }
          : null
      );
    });
    return () => {
      cancelled = true;
    };
  }, [venue]);
  return brand;
}

/**
 * "Trivia at Joe's Tavern": the bar's logo, name, welcome line and
 * tonight's prize, in the bar's color. Shows nothing for an unbranded venue.
 * `compact` is the one-line prize pill for the lobby and the results.
 */
export function VenueBanner({ venue, compact = false, big = false }: { venue?: string | null; compact?: boolean; big?: boolean }) {
  const brand = useVenueBrand(venue);
  if (!brand) return null;
  const accent = brand.accent || "#fbbf24";

  if (compact) {
    if (!brand.prize) return null;
    return (
      <p
        className="self-center rounded-full border-2 px-4 py-1.5 text-sm font-black text-center animate-pop-in"
        style={{ borderColor: accent, color: accent, background: `${accent}1f` }}
      >
        Prize: {brand.prize}
      </p>
    );
  }

  return (
    <div
      className={`w-full rounded-3xl border-2 flex items-center gap-3 text-left animate-pop-in ${big ? "max-w-2xl p-5 gap-5" : "max-w-sm p-3"}`}
      style={{ borderColor: accent, background: `${accent}1a` }}
    >
      {brand.logoUrl && (
        <img src={brand.logoUrl} alt="" className={`shrink-0 rounded-2xl bg-white object-contain ${big ? "w-28 h-28 p-2" : "w-16 h-16 p-1"}`} />
      )}
      <div className="min-w-0">
        <p className={`font-bold uppercase tracking-widest text-white/70 ${big ? "text-base" : "text-[11px]"}`}>Trivia at</p>
        <p className={`font-black leading-tight ${big ? "text-4xl" : "text-xl"}`} style={{ color: accent }}>
          {brand.name}
        </p>
        {brand.welcome && <p className={`text-white/90 ${big ? "text-xl mt-1" : "text-sm"}`}>{brand.welcome}</p>}
        {brand.prize && (
          <p className={`mt-1 font-black text-white ${big ? "text-xl" : "text-sm"}`}>
            Prize: <span style={{ color: accent }}>{brand.prize}</span>
          </p>
        )}
      </div>
    </div>
  );
}
