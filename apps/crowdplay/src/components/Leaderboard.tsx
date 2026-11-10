"use client";

import { useEffect, useState } from "react";
import { ChestUp } from "@/components/ChestUp";
import { supabase } from "@/lib/supabase";
import { deviceKey } from "@/lib/device";
import { usePlayerVenue } from "@/lib/venue";

type Spot = { key: string; name: string; emoji: string | null; imageUrl: string | null; isMe: boolean };

// Stand-ins that fill the empty spots until enough people have played this week.
const PLACEHOLDERS: Spot[] = [
  { key: "p1", name: "Trivia Tara", emoji: null, imageUrl: "/avatars/crystal-titan-256.png", isMe: false },
  { key: "p2", name: "Quiz Khalifa", emoji: null, imageUrl: "/avatars/model-z-256.png", isMe: false },
  { key: "p3", name: "Big Brain Ben", emoji: null, imageUrl: "/avatars/jungle-scout-256.png", isMe: false },
  { key: "p4", name: "Nacho Average", emoji: null, imageUrl: "/avatars/void-walker-256.png", isMe: false },
  { key: "p5", name: "Captain Clue", emoji: null, imageUrl: "/avatars/geo-sphinx-256.png", isMe: false },
];

/**
 * Players of the week: the top 5 by XP earned this week around here (the
 * bar's area, e.g. Chicago), chest up with their names.
 * Resets every Monday.
 */
export function Leaderboard() {
  const venue = usePlayerVenue();
  const [spots, setSpots] = useState<Spot[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      supabase
        .rpc("get_leaderboard", { p_venue: venue ?? "main", p_scope: "area", p_device_key: deviceKey() })
        .then(({ data }) => {
          if (cancelled) return;
          const real: Spot[] = (data ?? [])
            .filter((r) => r.o_rank <= 5)
            .map((r) => ({ key: `r${r.o_rank}`, name: r.o_name, emoji: r.o_emoji, imageUrl: r.o_image_url, isMe: r.o_is_me }));
          setSpots([...real, ...PLACEHOLDERS.slice(real.length)].slice(0, 5));
        });
    load();
    window.addEventListener("slimpse:progress", load);
    return () => {
      cancelled = true;
      window.removeEventListener("slimpse:progress", load);
    };
  }, [venue]);

  if (spots === null) return null;

  return (
    <div className="w-full rounded-3xl bg-white/[0.06] border border-white/15 px-3 py-3">
      <div className="px-1">
        <p className="text-[11px] font-bold uppercase tracking-widest text-amber-300">Players of the week</p>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1.5 justify-items-center">
        {spots.map((s) => (
          <ChestUp key={s.key} imageUrl={s.imageUrl} emoji={s.emoji} name={s.name} width={60} highlight={s.isMe} />
        ))}
      </div>
    </div>
  );
}
