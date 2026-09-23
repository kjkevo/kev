"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * With a venue, the code goes through that venue's check-in page first and
 * then on to the game, so every scan and check-in is counted.
 */
export function JoinQRCode({ code, basePath = "/play", venue }: { code: string; basePath?: string; venue?: string }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const gamePath = `${basePath}/${code}`;
  const url = venue
    ? `${origin}/checkin/${venue}?next=${encodeURIComponent(gamePath)}&src=qr`
    : `${origin}${gamePath}`;

  return (
    <div className="bg-white p-4 rounded-2xl inline-block">
      <QRCodeSVG value={url} size={220} />
    </div>
  );
}
