"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * Straight into the game, no sign-up form. With a venue, the link is tagged
 * (?venue=…&src=qr) so the scan is counted and the phone remembers the bar.
 * With a team, whoever scans joins that team (a teammate's invite).
 */
export function JoinQRCode({
  code,
  basePath = "/play",
  venue,
  size = 220,
  team,
}: {
  code: string;
  basePath?: string;
  venue?: string;
  size?: number;
  team?: string | null;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const gamePath = `${basePath}/${code}`;
  const params = new URLSearchParams();
  if (venue) {
    params.set("venue", venue);
    params.set("src", "qr");
  }
  if (team) params.set("team", team);
  const url = params.size > 0 ? `${origin}${gamePath}?${params}` : `${origin}${gamePath}`;

  return (
    <div className={`bg-white rounded-2xl inline-block ${size < 150 ? "p-2" : "p-4"}`}>
      <QRCodeSVG value={url} size={size} />
    </div>
  );
}
