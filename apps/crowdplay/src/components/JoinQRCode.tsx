"use client";

import { QRCodeSVG } from "qrcode.react";

export function JoinQRCode({ code }: { code: string }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/play/${code}`;

  return (
    <div className="bg-white p-4 rounded-2xl inline-block">
      <QRCodeSVG value={url} size={220} />
    </div>
  );
}
