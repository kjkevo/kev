"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { DEFAULT_VENUE } from "@/lib/venue";
import { GameCarousel } from "@/components/GameCarousel";

/**
 * The venue's "scan to play" display: headline, "free to play" and the QR
 * code, over a faded Hivian wordmark. The code opens the all-games menu,
 * tagged so the dashboard counts the arrival. The live game strip sits
 * underneath.
 */
export default function QrPage() {
  const [url, setUrl] = useState("");
  const [venue, setVenue] = useState<string | null>(null);

  useEffect(() => {
    // src=qr lets the dashboard count arrivals; venue sends them to that bar's games.
    const v = new URLSearchParams(window.location.search).get("venue") || DEFAULT_VENUE;
    setVenue(v);
    setUrl(`${window.location.origin}/?src=qr&venue=${encodeURIComponent(v)}`);
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white px-6 py-12 text-center">
      {/* Faded company wordmark behind everything */}
      <div aria-hidden="true" className="pointer-events-none select-none absolute -inset-1/4 flex flex-col justify-center gap-6 -rotate-12">
        {Array.from({ length: 9 }, (_, row) => (
          <div
            key={row}
            className={`whitespace-nowrap font-black tracking-tight text-white/[0.05] text-7xl sm:text-9xl leading-none ${row % 2 ? "pl-24" : ""}`}
          >
            {"Hivian   ".repeat(8)}
          </div>
        ))}
      </div>

      <div className="relative">
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight">
          Become the best in the <span className="text-amber-400">Midwest</span>
        </h1>
        <p className="mt-3 text-3xl sm:text-5xl font-black tracking-tight text-indigo-100">Free to play</p>
      </div>

      <div className="relative bg-white p-6 rounded-3xl shadow-2xl">
        {url ? <QRCodeSVG value={url} size={280} /> : <div style={{ width: 280, height: 280 }} />}
      </div>

      {venue && (
        <div className="relative w-full flex justify-center">
          <GameCarousel venue={venue} />
        </div>
      )}
    </main>
  );
}
