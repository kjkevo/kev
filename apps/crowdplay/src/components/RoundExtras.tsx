"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Ad = { name: string; headline: string; tagline: string | null; accent: string };

/**
 * The fun fact about the answer just revealed. The server only hands it out
 * once the question is over, so it can't give anything away early.
 */
export function FunFact({ roomId, questionIndex, big = false }: { roomId: string; questionIndex: number; big?: boolean }) {
  const [fact, setFact] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFact(null);
    supabase.rpc("get_round_extras", { p_room: roomId }).then(({ data }) => {
      if (!cancelled) setFact(data?.[0]?.o_fun_fact ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [roomId, questionIndex]);

  if (!fact) return null;
  return (
    <div
      className={`w-full rounded-2xl bg-violet-500/10 border border-violet-400/40 text-left animate-pop-in ${
        big ? "max-w-2xl px-6 py-5" : "px-4 py-4"
      }`}
      style={{ animationDelay: "400ms", animationFillMode: "both" }}
    >
      <p className={`uppercase tracking-widest text-violet-300 mb-1 ${big ? "text-base" : "text-xs"}`}>💡 Fun fact</p>
      <p className={`font-semibold text-slate-100 ${big ? "text-2xl" : "text-lg"}`}>{fact}</p>
    </div>
  );
}

/**
 * An ad slot for the phone's scores screen: one of the venue's active
 * sponsors (a different one each question), or an open slot when the venue
 * has none yet.
 */
export function AdSlot({ venue, questionIndex }: { venue: string; questionIndex: number }) {
  const [ads, setAds] = useState<Ad[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc("get_screen_ads", { p_venue: venue }).then(({ data }) => {
      if (cancelled) return;
      setAds((data ?? []).map((a) => ({ name: a.o_name, headline: a.o_headline, tagline: a.o_tagline, accent: a.o_accent })));
    });
    return () => {
      cancelled = true;
    };
  }, [venue]);

  if (!ads) return null;
  const ad = ads.length > 0 ? ads[questionIndex % ads.length] : null;
  if (!ad) {
    return (
      <div className="w-full rounded-2xl border border-dashed border-white/15 px-4 py-5 text-center text-slate-500">
        <p className="text-xs uppercase tracking-widest mb-1">Sponsored</p>
        <p className="text-sm">Your ad here. Ask the bar about sponsoring trivia night.</p>
      </div>
    );
  }
  return (
    <div className="w-full rounded-2xl bg-slate-900 border-2 px-4 py-4 text-left" style={{ borderColor: ad.accent }}>
      <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Tonight&apos;s sponsor</p>
      <p className="text-xl font-black" style={{ color: ad.accent }}>
        {ad.headline}
      </p>
      <p className="text-slate-300 text-sm">
        {ad.name}
        {ad.tagline ? ` · ${ad.tagline}` : ""}
      </p>
    </div>
  );
}
