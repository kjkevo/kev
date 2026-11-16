"use client";

import { QRCodeSVG } from "qrcode.react";
import { checkinUrl } from "@/lib/checkin";

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
  checkinCode,
}: {
  code: string;
  basePath?: string;
  venue?: string;
  size?: number;
  team?: string | null;
  /** On the bar's TV: also check the phone in at this bar (today's code). */
  checkinCode?: string | null;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const gamePath = `${basePath}/${code}`;
  const params = new URLSearchParams();
  if (venue) {
    params.set("venue", venue);
    params.set("src", "qr");
  }
  if (team) params.set("team", team);
  const path = params.size > 0 ? `${gamePath}?${params}` : gamePath;
  const url = checkinCode && venue ? checkinUrl(origin, venue, checkinCode, path) : `${origin}${path}`;

  return (
    <div className={`bg-white rounded-2xl inline-block ${size < 150 ? "p-2" : "p-4"}`}>
      <QRCodeSVG value={url} size={size} />
    </div>
  );
}
