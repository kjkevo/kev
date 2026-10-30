"use client";

/* eslint-disable @next/next/no-img-element -- small character face */

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { powerByKey, powerFace } from "@/lib/powers";
import { playerKey, type PlayerCredentials } from "@/lib/types";

type Toast = { id: string; who: string; power: string };

const SHOW_MS = 5000;

/**
 * When anyone on your team uses their character's power, a card slides in
 * from the right edge for 5 seconds: whose power, what it's called and what
 * it does. It sits over every screen (question, reveal, scores), off to the
 * side so it never covers the answers. Self-contained: it reads this phone's
 * spot in the game and listens for powers on its own.
 */
export function TeamPowerToasts({ code }: { code: string | null }) {
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
    if (!creds?.roomId || !creds.teamId) return;
    const { roomId, teamId, playerId } = creds;
    const show = async (row: { id: string; team_id: string; player_id: string; power: string }) => {
      if (row.team_id !== teamId || seen.current.has(row.id)) return;
      seen.current.add(row.id);
      let who = "You";
      if (row.player_id !== playerId) {
        const { data } = await supabase.from("players").select("nickname").eq("id", row.player_id).maybeSingle();
        who = data?.nickname ?? "A teammate";
      }
      setToasts((prev) => [...prev, { id: row.id, who, power: row.power }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== row.id)), SHOW_MS);
    };
    // Powers already used before this phone started listening don't pop up.
    let primed = false;
    const teamPowers = () =>
      supabase.from("trivia_powers").select("id, team_id, player_id, power").eq("room_id", roomId).eq("team_id", teamId);
    teamPowers().then(({ data }) => {
      data?.forEach((r) => seen.current.add(r.id));
      primed = true;
    });
    const channel = supabase
      .channel(`team-power-toasts:${roomId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trivia_powers", filter: `room_id=eq.${roomId}` }, (payload) =>
        show(payload.new as { id: string; team_id: string; player_id: string; power: string })
      )
      .subscribe();
    // Backup for a phone without a live connection (busy nights): check every few seconds.
    const poll = setInterval(() => {
      if (primed) teamPowers().then(({ data }) => data?.forEach((r) => show(r)));
    }, 4000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [creds]);

  if (toasts.length === 0) return null;
  return (
    <div className="fixed right-2 bottom-20 z-50 flex flex-col items-end gap-2 pointer-events-none">
      {toasts.map((t) => {
        const power = powerByKey(t.power);
        const face = powerFace(t.power);
        return (
          <div
            key={t.id}
            className="toast-slide-in w-56 max-w-[65vw] flex items-center gap-2.5 rounded-2xl bg-violet-600 border-2 border-violet-300 px-3 py-2.5 shadow-xl shadow-violet-500/40"
          >
            {face && <img src={face} alt="" className="w-12 h-12 shrink-0 rounded-full bg-black/30 object-cover" />}
            <div className="min-w-0 text-left">
              <p className="text-[11px] font-bold uppercase tracking-wider text-violet-100 truncate">{t.who} used</p>
              <p className="font-black text-white leading-tight">{power?.name ?? "a power"}</p>
              {power && <p className="text-xs text-violet-100 leading-snug">{power.how}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
