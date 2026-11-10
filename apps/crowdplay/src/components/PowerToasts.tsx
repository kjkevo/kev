"use client";

/* eslint-disable @next/next/no-img-element -- small character face */

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { powerByKey, powerFace } from "@/lib/powers";
import { perkInfo } from "@/lib/perks";
import { playerKey, type PlayerCredentials } from "@/lib/types";

type Toast = { id: string; who: string; power: string; mine: boolean; perk?: boolean };

const SHOW_MS = 5000;
const MAX_SHOWN = 4;

/**
 * Whenever anyone in the game uses a power, a small card slides in at the
 * right edge for 5 seconds: whose face, their name and the power. Several at
 * once stack on top of each other (newest at the bottom, at most 4). Small
 * and off to the side so it never covers the question or the answers. Your
 * team's powers are purple, other teams' are dark. Self-contained: it reads
 * this phone's spot in the game and listens for powers on its own.
 */
export function PowerToasts({ code }: { code: string | null }) {
  const [creds, setCreds] = useState<PlayerCredentials | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef(new Set<string>());

  // This phone's spot (team can change in the lobby, so re-read now and then).
  useEffect(() => {
    if (!code) return;
    const read = () => {
      try {
        const raw = localStorage.getItem(playerKey(code));
        const next = raw ? (JSON.parse(raw) as PlayerCredentials) : null;
        setCreds((prev) => (prev?.teamId === next?.teamId && prev?.roomId === next?.roomId ? prev : next));
      } catch {
        // storage blocked: no notifications, the game still works
      }
    };
    read();
    const t = setInterval(read, 4000);
    return () => clearInterval(t);
  }, [code]);

  useEffect(() => {
    if (!creds?.roomId) return;
    const { roomId, teamId, playerId } = creds;
    const names = new Map<string, string>();
    const show = async (row: { id: string; team_id: string; player_id: string; power: string }, perk = false) => {
      if (seen.current.has(row.id)) return;
      seen.current.add(row.id);
      let who = "You";
      if (row.player_id !== playerId) {
        if (!names.has(row.player_id)) {
          const { data } = await supabase.from("players").select("nickname").eq("id", row.player_id).maybeSingle();
          names.set(row.player_id, (data?.nickname ?? "Someone").replace(/ ·[0-9a-z]{4}$/, ""));
        }
        who = names.get(row.player_id)!;
      }
      setToasts((prev) => [...prev, { id: row.id, who, power: row.power, mine: row.team_id === teamId, perk }].slice(-MAX_SHOWN));
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== row.id)), SHOW_MS);
    };
    // Powers already used before this phone started listening don't pop up.
    let primed = false;
    const roomPowers = () => supabase.from("trivia_powers").select("id, team_id, player_id, power").eq("room_id", roomId);
    // Perks (Time Freeze, All In, a Mirror going off...) show the same way.
    const roomPerks = () => supabase.from("trivia_perks").select("id, team_id, player_id, perk").eq("room_id", roomId);
    const asPower = (r: { id: string; team_id: string; player_id: string; perk: string }) => ({ ...r, power: r.perk });
    Promise.all([roomPowers(), roomPerks()]).then(([a, b]) => {
      a.data?.forEach((r) => seen.current.add(r.id));
      b.data?.forEach((r) => seen.current.add(r.id));
      primed = true;
    });
    const channel = supabase
      .channel(`power-toasts:${roomId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trivia_powers", filter: `room_id=eq.${roomId}` }, (payload) =>
        show(payload.new as { id: string; team_id: string; player_id: string; power: string })
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trivia_perks", filter: `room_id=eq.${roomId}` }, (payload) =>
        show(asPower(payload.new as { id: string; team_id: string; player_id: string; perk: string }), true)
      )
      .subscribe();
    // Backup for a phone without a live connection (busy nights): check every few seconds.
    const poll = setInterval(() => {
      if (!primed) return;
      roomPowers().then(({ data }) => data?.forEach((r) => show(r)));
      roomPerks().then(({ data }) => data?.forEach((r) => show(asPower(r), true)));
    }, 4000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [creds]);

  if (toasts.length === 0) return null;
  return (
    <div className="fixed right-2 bottom-20 z-50 flex flex-col items-end gap-1.5 pointer-events-none">
      {toasts.map((t) => {
        const power = t.perk ? null : powerByKey(t.power);
        const face = t.perk ? null : powerFace(t.power);
        const perk = t.perk ? perkInfo(t.power) : null;
        return (
          <div
            key={t.id}
            className={`toast-slide-in max-w-[62vw] flex items-center gap-2 rounded-full pl-1 pr-3 py-1 shadow-lg ${
              t.mine ? "bg-violet-600/95 border border-violet-300/80 shadow-violet-500/30" : "bg-slate-800/95 border border-white/20"
            }`}
          >
            {face && <img src={face} alt="" className="w-7 h-7 shrink-0 rounded-full bg-black/30 object-cover" />}
            {perk && <span className="w-7 h-7 shrink-0 rounded-full bg-black/30 flex items-center justify-center text-base">{perk.icon}</span>}
            <p className="min-w-0 truncate text-xs text-white">
              {perk?.key === "mirror" ? (
                <>
                  <span className="font-bold">{t.who === "You" ? "Your" : `${t.who}'s`}</span>
                  <span className="text-white/70"> <span className="font-black text-white">Mirror</span> bounced a Void Rift</span>
                </>
              ) : (
                <>
                  <span className="font-bold">{t.who}</span>
                  <span className="text-white/70"> used </span>
                  <span className="font-black">{perk?.name ?? power?.name ?? "a power"}</span>
                </>
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}
