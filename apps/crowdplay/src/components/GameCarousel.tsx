"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/components/Avatar";

type LiveGame = { phase: string; starts_at: string | null; question?: number; total?: number; teams?: number; players?: number };
type FeedItem = { id: string; game: string; kind: string; text: string; at: string; emoji: string | null; image_url: string | null };
type Carousel = {
  now: string;
  trivia: LiveGame | null;
  next_trivia: { code: string; players: number } | null;
  feud: LiveGame | null;
  bingo: LiveGame | null;
  items: FeedItem[];
};
type Slide = { key: string; game: string; text: string; emoji?: string | null; imageUrl?: string | null; startsAt?: string };

const GAME_NAMES: Record<string, string> = { trivia: "Trivia", feud: "Family Feud", bingo: "Bingo" };
const SLIDE_MS = 4000;

function clock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function statusSlides(c: Carousel): Slide[] {
  const out: Slide[] = [];
  const t = c.trivia;
  if (t?.phase === "lobby" && t.starts_at) {
    out.push({ key: "t-lobby", game: "trivia", text: "starts in", startsAt: t.starts_at });
  } else if (t?.phase === "question") {
    out.push({ key: "t-q", game: "trivia", text: `Question ${t.question} of ${t.total || "?"} · ${t.teams} teams playing` });
  }
  if (c.next_trivia) {
    out.push({
      key: "t-next",
      game: "trivia",
      text: `Next game open · ${c.next_trivia.players} signed up`,
    });
  }
  // Feud and Bingo are "coming soon" on the menu, so the strip only covers
  // trivia for now; add them back here when they launch.
  for (const g of [] as ("feud" | "bingo")[]) {
    const r = c[g];
    if (!r) continue;
    if (r.phase === "lobby" && r.starts_at) out.push({ key: `${g}-lobby`, game: g, text: "starts in", startsAt: r.starts_at });
    else if (r.phase !== "lobby" && r.phase !== "final") out.push({ key: `${g}-live`, game: g, text: "game in progress" });
  }
  return out;
}

/**
 * A slim rotating strip of what's happening at the venue: countdowns, points
 * as teams earn them, winners and shoutouts. Scores show here live on
 * purpose (phones keep them hidden until the end).
 */
export function GameCarousel({ venue }: { venue: string }) {
  const [data, setData] = useState<Carousel | null>(null);
  const [skew, setSkew] = useState(0);
  const [index, setIndex] = useState(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      supabase.rpc("get_carousel", { p_venue: venue }).then(({ data }) => {
        if (cancelled || !data) return;
        const c = data as unknown as Carousel;
        setSkew(Date.parse(c.now) - Date.now());
        setData(c);
      });
    load();
    const t = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [venue]);

  const slides = useMemo<Slide[]>(() => {
    if (!data) return [];
    const events = data.items.slice(0, 8).map((i) => ({
      key: i.id,
      game: i.game,
      text: i.text,
      emoji: i.emoji,
      imageUrl: i.image_url,
    }));
    return [...statusSlides(data), ...events];
  }, [data]);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => i + 1), SLIDE_MS);
    const c = setInterval(() => setTick((n) => n + 1), 1000); // live countdowns
    return () => {
      clearInterval(t);
      clearInterval(c);
    };
  }, []);

  if (slides.length === 0) return null;
  const slide = slides[index % slides.length];
  const hasAvatar = slide.emoji || slide.imageUrl;
  const text = slide.startsAt ? `${slide.text} ${clock(Date.parse(slide.startsAt) - (Date.now() + skew))}` : slide.text;

  return (
    <div
      className="w-full max-w-md rounded-full bg-white/10 border border-white/15 px-4 py-2 flex items-center gap-2 text-sm overflow-hidden"
      role="status"
      aria-live="polite"
    >
      <span className="shrink-0 font-bold text-amber-400">{GAME_NAMES[slide.game] ?? slide.game}</span>
      <span className="text-white/30" aria-hidden="true">
        ·
      </span>
      {hasAvatar && <Avatar emoji={slide.emoji} imageUrl={slide.imageUrl} size={30} />}
      <span key={slide.key} className="truncate animate-[fadeIn_400ms_ease-out]">
        {text}
      </span>
    </div>
  );
}
