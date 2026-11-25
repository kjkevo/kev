"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { usePlayerVenue } from "@/lib/venue";
import { checkinUrl, useScreenCheckin } from "@/lib/checkin";

/**
 * The "scan to play" code for Trivia: straight into a game when a room
 * code is given, otherwise the Trivia page (Solo or Team Play). Used on the
 * venue TV and the home screen. Without a venue it uses this page's bar
 * (?venue=, or the one this device remembers).
 */
export function ScanCards({ venue: venueProp, triviaCode, big = false }: { venue?: string; triviaCode?: string | null; big?: boolean }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const pageVenue = usePlayerVenue();
  const venue = venueProp ?? pageVenue;
  const code = useScreenCheckin(venue);
  if (!origin || !venue || code === undefined) return null;
  if (code === null) return <NotPaired />;
  const v = encodeURIComponent(venue);
  // Scanning checks the phone in at this bar, then opens the game.
  const trivia = checkinUrl(origin, venue, code, triviaCode ? `/play/${triviaCode}?venue=${v}&src=qr` : `/trivia?venue=${v}&src=qr`);
  const size = big ? 220 : 132;
  return (
    <div className={`flex flex-wrap justify-center ${big ? "gap-10" : "gap-4"}`}>
      <Card title="Trivia" line={triviaCode ? `Game ${triviaCode} · scan to join` : null} url={trivia} size={size} big={big} accent />
    </div>
  );
}

function Card({ title, line, url, size, big, accent = false }: { title: string; line: string | null; url: string; size: number; big: boolean; accent?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center rounded-3xl border ${accent ? "border-amber-400/60 bg-amber-400/10" : "border-white/15 bg-white/5"} ${
        big ? "gap-3 p-6" : "gap-2 p-3"
      }`}
    >
      <p className={`font-black ${accent ? "text-amber-300" : "text-white"} ${big ? "text-3xl" : "text-lg"}`}>{title}</p>
      <div className={`bg-white rounded-2xl ${big ? "p-4" : "p-2"}`}>
        <QRCodeSVG value={url} size={size} />
      </div>
      {line && <p className={`text-slate-300 font-semibold ${big ? "text-lg" : "text-xs"}`}>{line}</p>}
    </div>
  );
}

/**
 * The main menu's one big code. Scanning it opens the menu on the phone,
 * where the four games are big buttons to tap.
 */
export function MenuScanCode() {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const venue = usePlayerVenue();
  const code = useScreenCheckin(venue);
  if (code === null) return <NotPaired />;
  // Scanning checks the phone in at this bar, then opens the games menu.
  const url = origin && venue && code ? checkinUrl(origin, venue, code, `/?venue=${encodeURIComponent(venue)}&src=menu`) : "";
  return (
    <div className="rounded-[2rem] border-2 border-amber-400/60 bg-amber-400/10 p-6 flex flex-col items-center gap-4">
      <p className="text-4xl font-black text-amber-300">Scan to play</p>
      <div className="bg-white rounded-3xl p-5">{url ? <QRCodeSVG value={url} size={300} /> : <div className="w-[300px] h-[300px]" />}</div>
    </div>
  );
}

/** A TV that hasn't been paired with the bar's setup link shows no code. */
function NotPaired() {
  return (
    <div className="rounded-[2rem] border-2 border-white/15 bg-white/5 p-8 flex flex-col items-center gap-3 max-w-md">
      <p className="text-3xl font-black text-amber-300">Screen not set up</p>
      <p className="text-xl font-bold text-slate-200">Open this bar&apos;s setup link on this screen once to show the code.</p>
    </div>
  );
}
