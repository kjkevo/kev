"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { DEFAULT_VENUE } from "@/lib/venue";
import { GameCarousel } from "@/components/GameCarousel";
import { Avatar } from "@/components/Avatar";
import { useTriviaChampion } from "@/hooks/useTriviaChampion";

/**
 * The venue's "scan to play" display: headline, "free to play" and the QR
 * code, over a faded Hivian wordmark. The code opens the all-games menu,
 * tagged so the dashboard counts the arrival. The live game strip sits
 * underneath.
 */
export default function QrPage() {
  const [url, setUrl] = useState("");
  const [venue, setVenue] = useState<string | null>(null);
  const champion = useTriviaChampion(venue);

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

      {/* Wide (horizontal) screens: QR on the left, this month's champion on
          the right. Phones and portrait screens show the QR alone. */}
      <div className="relative flex flex-col items-center gap-10 lg:landscape:flex-row lg:landscape:gap-16">
        <div className="bg-white p-6 rounded-3xl shadow-2xl">
          {url ? <QRCodeSVG value={url} size={280} /> : <div style={{ width: 280, height: 280 }} />}
        </div>

        <div className="hidden lg:landscape:flex flex-col items-center text-center w-80">
          {champion ? (
            <>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-amber-400">Champion of the month</p>
              <Avatar emoji={champion.emoji} imageUrl={champion.imageUrl} size={220} variant="full" className="mt-3" />
              <p className="mt-2 text-4xl font-black tracking-tight break-words max-w-full">{champion.nickname}</p>
              <p className="mt-2 text-xl font-semibold text-indigo-100">
                Won {champion.streak} trivia games in a row
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-amber-400">Champion of the month</p>
              <div className="mt-3 w-[220px] h-[220px] rounded-full border-4 border-dashed border-white/20 flex items-center justify-center text-7xl font-black text-white/25">
                ?
              </div>
              <p className="mt-4 text-2xl font-black">Could be you</p>
              <p className="mt-1 text-lg text-indigo-100">Win 3 trivia games in a row to take this spot</p>
            </>
          )}
        </div>
      </div>

      {venue && (
        <div className="relative w-full flex justify-center">
          <GameCarousel venue={venue} />
        </div>
      )}
    </main>
  );
}
