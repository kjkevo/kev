"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { usePlayerVenue } from "@/lib/venue";

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
  if (!origin || !venue) return null;
  const v = encodeURIComponent(venue);
  const trivia = triviaCode
    ? `${origin}/play/${triviaCode}?venue=${v}&src=qr`
    : `${origin}/trivia?venue=${v}&src=qr`;
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
 * A game's tile on a computer or TV: its name and the code to scan with a
 * phone (it opens that game's page at this bar). Not clickable, since the
 * game is played on phones.
 */
export function GameScanTile({ title, path, accent, note }: { title: string; path: string; accent: "amber" | "sky" | "pink"; note?: string }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const venue = usePlayerVenue();
  const url = origin ? `${origin}${path}?venue=${encodeURIComponent(venue ?? "main")}&src=qr` : "";
  const ring =
    accent === "amber"
      ? "border-amber-400/60 bg-amber-400/10 text-amber-300"
      : accent === "sky"
        ? "border-sky-400/60 bg-sky-400/10 text-sky-300"
        : "border-pink-400/50 bg-pink-400/10 text-pink-300";
  return (
    <div className={`rounded-3xl border p-4 flex flex-col items-center gap-2 ${ring}`}>
      <div className="font-black text-2xl leading-tight">{title}</div>
      <div className="bg-white rounded-2xl p-2">{url ? <QRCodeSVG value={url} size={130} /> : <div className="w-[130px] h-[130px]" />}</div>
      <div className="text-sm font-bold text-slate-200">{note ?? "Scan with your phone"}</div>
    </div>
  );
}
