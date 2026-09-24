"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * With a venue, the code goes through that venue's check-in page first and
 * then on to the game, so every scan and check-in is counted.
 */
export function JoinQRCode({
  code,
  basePath = "/play",
  venue,
  size = 220,
}: {
  code: string;
  basePath?: string;
  venue?: string;
  size?: number;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const gamePath = `${basePath}/${code}`;
  const url = venue
    ? `${origin}/checkin/${venue}?next=${encodeURIComponent(gamePath)}&src=qr`
    : `${origin}${gamePath}`;

  return (
    <div className={`bg-white rounded-2xl inline-block ${size < 150 ? "p-2" : "p-4"}`}>
      <QRCodeSVG value={url} size={size} />
    </div>
  );
}
