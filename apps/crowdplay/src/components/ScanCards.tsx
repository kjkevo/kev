"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

/**
 * "Scan to play" codes for each game, side by side: Trivia (straight into
 * the current game when a room code is given, otherwise the trivia page)
 * and Social Bingo (its demo for now). Used on the venue TV and the home
 * screen.
 */
export function ScanCards({ venue, triviaCode, big = false }: { venue: string; triviaCode?: string | null; big?: boolean }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  if (!origin) return null;
  const v = encodeURIComponent(venue);
  const trivia = triviaCode
    ? `${origin}/play/${triviaCode}?venue=${v}&src=qr`
    : `${origin}/trivia?venue=${v}&src=qr`;
  const bingo = `${origin}/bingo/demo?venue=${v}&src=qr`;
  const size = big ? 220 : 132;
  return (
    <div className={`flex flex-wrap justify-center ${big ? "gap-10" : "gap-4"}`}>
      <Card title="Trivia" line={triviaCode ? `Game ${triviaCode} · scan to join` : "Scan to play"} url={trivia} size={size} big={big} accent />
      <Card title="Social Bingo" line="Scan to try the demo" url={bingo} size={size} big={big} />
    </div>
  );
}

function Card({ title, line, url, size, big, accent = false }: { title: string; line: string; url: string; size: number; big: boolean; accent?: boolean }) {
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
      <p className={`text-slate-300 font-semibold ${big ? "text-lg" : "text-xs"}`}>{line}</p>
    </div>
  );
}
