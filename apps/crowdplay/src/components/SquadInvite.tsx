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
  compact = false,
}: {
  code: string;
  teamId: string;
  teamName: string;
  venue: string;
  spotsLeft: number;
  /** Just the QR, "3 spots left" and Share, to sit beside the team. */
  compact?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [big, setBig] = useState(false);

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
      setNote("Link copied");
    } catch {
      // share sheet dismissed
    }
  }

  if (spotsLeft <= 0) return null;
  if (compact) {
    return (
      <div className="flex flex-col items-center gap-1 shrink-0">
        <button type="button" onClick={() => setBig(true)} aria-label="Enlarge QR code" className="bg-white p-1.5 rounded-lg active:scale-95 transition">
          {url ? <QRCodeSVG value={url} size={88} /> : <div style={{ width: 88, height: 88 }} />}
        </button>
        <p className="text-[11px] font-bold text-amber-300">
          {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left
        </p>
        <div className="flex gap-2 text-[11px] font-bold">
          <button type="button" onClick={() => setBig(true)} className="rounded-full bg-amber-400 text-black px-2.5 py-0.5 active:scale-95">
            Enlarge
          </button>
          <button type="button" onClick={share} className="text-slate-300 underline underline-offset-2">
            {note ?? "Share"}
          </button>
        </div>
        {big && (
          // Full screen, so a friend can scan it from across the table.
          <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center gap-5 px-6" onClick={() => setBig(false)}>
            <p className="text-2xl font-black text-white text-center">Join {teamName}</p>
            <div className="bg-white p-4 rounded-3xl w-full max-w-[22rem]" onClick={(e) => e.stopPropagation()}>
              {url && <QRCodeSVG value={url} size={320} style={{ width: "100%", height: "auto" }} />}
            </div>
            <p className="text-lg font-bold text-amber-300">
              {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left
            </p>
            <button
              type="button"
              onClick={() => setBig(false)}
              className="rounded-full bg-white/15 border border-white/30 px-6 py-2.5 font-bold text-white active:scale-95"
            >
              Shrink
            </button>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="w-full max-w-xs rounded-2xl bg-white/5 border border-amber-400/30 p-4 flex flex-col items-center gap-3">
      <div className="text-center">
        <p className="text-base font-bold">Invite your squad</p>
        <p className="text-xs text-slate-400">
          {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left
        </p>
      </div>
      <div className="bg-white p-3 rounded-xl">{url ? <QRCodeSVG value={url} size={160} /> : <div style={{ width: 160, height: 160 }} />}</div>
      <button
        type="button"
        onClick={share}
        className="text-sm font-bold rounded-full bg-amber-400/15 text-amber-300 px-4 py-1.5 active:scale-95"
      >
        Share link
      </button>
      {note && <p className="text-xs text-amber-300/80">{note}</p>}
    </div>
  );
}
