"use client";

/* eslint-disable @next/next/no-img-element -- the card is a generated image */

import { useEffect, useState } from "react";

const W = 1080;
const H = 1350;

function ordinal(n: number) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

/** The headline on the card: "I won trivia at …", "I took 2nd at trivia at …", or "I played trivia at …". */
export function shareHeadline(rank: number, venue: string) {
  if (rank === 1) return `I won trivia at ${venue}`;
  if (rank <= 3) return `I took ${ordinal(rank)} at trivia at ${venue}`;
  return `I played trivia at ${venue}`;
}

/** A personal award shown on the card ("Fastest finger · Right answer in 2.1s"). */
export type ShareAward = { icon: string; title: string; detail: string };

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Wraps text onto lines no wider than maxWidth; returns the lines. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

async function drawCard(opts: {
  rank: number;
  venue: string;
  nickname: string;
  teamName: string;
  score: number;
  imageUrl?: string | null;
  emoji?: string | null;
  award?: ShareAward | null;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1e1b4b");
  bg.addColorStop(0.55, "#3b0764");
  bg.addColorStop(1, "#000000");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Spotlight behind the character.
  const glow = ctx.createRadialGradient(W / 2, 640, 40, W / 2, 640, 460);
  glow.addColorStop(0, opts.rank === 1 ? "rgba(251,191,36,0.45)" : "rgba(165,180,252,0.35)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = "#fbbf24";
  ctx.font = "900 64px system-ui, -apple-system, sans-serif";
  ctx.fillText(opts.rank === 1 ? "CHAMPION" : `${ordinal(opts.rank).toUpperCase()} PLACE`, W / 2, 140);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 76px system-ui, -apple-system, sans-serif";
  const lines = wrap(ctx, shareHeadline(opts.rank, opts.venue), W - 140);
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, W / 2, 250 + i * 88));

  const img = opts.imageUrl ? await loadImage(opts.imageUrl) : null;
  const top = 250 + Math.min(lines.length, 3) * 88 - 20;
  if (img) {
    const size = 480;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 40;
    ctx.drawImage(img, (W - size) / 2, top, size, size);
    ctx.shadowBlur = 0;
  }

  // The player's best award, as a pill under the character.
  if (opts.award) {
    ctx.font = "800 44px system-ui, -apple-system, sans-serif";
    const label = `${opts.award.title} · ${opts.award.detail}`;
    const tw = Math.min(ctx.measureText(label).width, W - 120);
    const y = H - 400;
    ctx.fillStyle = "rgba(251,191,36,0.18)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(W / 2 - tw / 2 - 36, y - 52, tw + 72, 76, 38);
    else ctx.rect(W / 2 - tw / 2 - 36, y - 52, tw + 72, 76);
    ctx.fill();
    ctx.fillStyle = "#fde68a";
    ctx.fillText(label, W / 2, y, W - 120);
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 60px system-ui, -apple-system, sans-serif";
  ctx.fillText(opts.nickname, W / 2, H - 285);
  ctx.fillStyle = "#c7d2fe";
  ctx.font = "600 40px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${opts.teamName} · ${opts.score.toLocaleString()} pts`, W / 2, H - 225);

  // Date and where to play, so every share points back to the bar and the app.
  ctx.fillStyle = "#a5b4fc";
  ctx.font = "600 34px system-ui, -apple-system, sans-serif";
  const date = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  ctx.fillText(`${date} · Play at slimpse.vercel.app`, W / 2, H - 150);

  ctx.font = "900 52px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  const brand = "Slim";
  const w1 = ctx.measureText(brand).width;
  const w2 = ctx.measureText("pse").width;
  ctx.textAlign = "left";
  ctx.fillText(brand, W / 2 - (w1 + w2) / 2, H - 70);
  ctx.fillStyle = "#fbbf24";
  ctx.fillText("pse", W / 2 - (w1 + w2) / 2 + w1, H - 70);

  return new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

/**
 * "I won trivia at [Venue]" (or 2nd, 3rd, "I played…"): a picture of the
 * player's character with their result and best award, ready to share to
 * stories or save to the camera roll. Every player gets one.
 */
export function ShareCard(props: {
  rank: number;
  venue: string;
  nickname: string;
  teamName: string;
  score: number;
  imageUrl?: string | null;
  emoji?: string | null;
  award?: ShareAward | null;
}) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const { rank, venue, nickname, teamName, score, imageUrl, emoji, award } = props;
  const awardKey = award ? `${award.icon}|${award.title}|${award.detail}` : "";

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    drawCard({ rank, venue, nickname, teamName, score, imageUrl, emoji, award }).then((b) => {
      if (cancelled || !b) return;
      url = URL.createObjectURL(b);
      setBlob(b);
      setPreview(url);
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- awardKey stands in for award
  }, [rank, venue, nickname, teamName, score, imageUrl, emoji, awardKey]);

  async function share() {
    if (!blob) return;
    const file = new File([blob], "slimpse-trivia.png", { type: "image/png" });
    const text = shareHeadline(rank, venue);
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
    } catch {
      return; // share sheet dismissed
    }
    // No share sheet (most computers): save the picture instead.
    const a = document.createElement("a");
    a.href = preview!;
    a.download = "slimpse-trivia.png";
    a.click();
    setNote("Saved to your downloads");
  }

  if (!preview) return null;
  return (
    <div className="flex flex-col items-center gap-2">
      <img src={preview} alt={shareHeadline(rank, venue)} className="w-56 rounded-xl border border-white/15 shadow-lg" />
      <button
        type="button"
        onClick={share}
        className="rounded-full bg-white text-black font-black px-5 py-2.5 text-sm active:scale-95 transition"
      >
        {rank === 1 ? "Share your win" : "Share your result"}
      </button>
      {note && <p className="text-xs text-slate-400">{note}</p>}
    </div>
  );
}
