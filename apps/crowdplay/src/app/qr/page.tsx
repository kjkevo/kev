"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { DEFAULT_VENUE } from "@/lib/venue";
import { GameCarousel } from "@/components/GameCarousel";

/**
 * A standalone QR code pointing at the site root -- not tied to any game or
 * room. Meant to be pulled up on a laptop/tablet and scanned with a phone
 * camera to test the whole flow end to end, starting from the all-games
 * menu, the same way a real bar patron would land on it.
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
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white px-6 py-16 text-center">
      <div>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
          Scan to <span className="text-amber-400">Play</span>
        </h1>
        <p className="mt-3 text-indigo-200">Point your phone&apos;s camera at this code to open CrowdPlay.</p>
      </div>

      {venue && <GameCarousel venue={venue} />}

      <div className="bg-white p-6 rounded-3xl shadow-2xl">
        {url ? <QRCodeSVG value={url} size={280} /> : <div style={{ width: 280, height: 280 }} />}
      </div>

      <p className="text-sm text-indigo-300/60 break-all max-w-xs">{url}</p>

      <Link href="/" className="text-sm text-amber-400 hover:text-amber-300 underline">
        Or just tap here on this device →
      </Link>
    </main>
  );
}
