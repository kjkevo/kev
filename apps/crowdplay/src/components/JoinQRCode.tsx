"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * Straight into the game, no sign-up form. With a venue, the link is tagged
 * (?venue=…&src=qr) so the scan is counted and the phone remembers the bar.
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
  const url = venue ? `${origin}${gamePath}?venue=${encodeURIComponent(venue)}&src=qr` : `${origin}${gamePath}`;

  return (
    <div className={`bg-white rounded-2xl inline-block ${size < 150 ? "p-2" : "p-4"}`}>
      <QRCodeSVG value={url} size={size} />
    </div>
  );
}
