"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

/**
 * "Invite your squad": a QR code (and share link) that opens this game on a
 * friend's phone with this team already picked, so they only type a name.
 */
export function SquadInvite({
  code,
  teamId,
  teamName,
  venue,
  spotsLeft,
}: {
  code: string;
  teamId: string;
  teamName: string;
  venue: string;
  spotsLeft: number;
}) {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ team: teamId, src: "qr", venue });
    setUrl(`${window.location.origin}/play/${code}?${params.toString()}`);
  }, [code, teamId, venue]);

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Join ${teamName} for trivia`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote("Link copied. Send it to your squad.");
    } catch {
      // share sheet dismissed
    }
  }

  if (spotsLeft <= 0) return null;
  return (
    <div className="w-full max-w-xs rounded-2xl bg-white/5 border border-amber-400/30 p-4 flex flex-col items-center gap-3">
      <div className="text-center">
        <p className="text-base font-bold">Invite your squad</p>
        <p className="text-xs text-slate-400">
          Friends scan this to join {teamName}. {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left.
        </p>
      </div>
      <div className="bg-white p-3 rounded-xl">{url ? <QRCodeSVG value={url} size={160} /> : <div style={{ width: 160, height: 160 }} />}</div>
      <button
        type="button"
        onClick={share}
        className="text-sm font-bold rounded-full bg-amber-400/15 text-amber-300 px-4 py-1.5 active:scale-95"
      >
        Share link instead
      </button>
      {note && <p className="text-xs text-amber-300/80">{note}</p>}
    </div>
  );
}
