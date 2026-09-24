"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/components/Avatar";
import type { PlayerCredentials } from "@/lib/types";

type Preset = { id: string; text: string; price_cents: number };
type Shoutout = { o_id: number; o_text: string; o_nickname: string; o_team_name: string | null; o_emoji: string | null; o_image_url: string | null };

const ERRORS: Record<string, string> = {
  SHOUTOUT_TOO_SOON: "One shoutout every 20 seconds. Hang on a moment.",
  SHOUTOUTS_OFF: "Shoutouts are switched off here right now.",
  SHOUTOUT_LOCKED: "That one isn't free.",
};

/**
 * The shoutout strip on a player's phone: the latest shoutouts from the
 * room, and a row of free presets to send. Sent shoutouts appear for
 * everyone after a 10-second delay (and on the venue's /qr carousel).
 */
export function Shoutouts({ roomId, creds, compact = false }: { roomId: string; creds: PlayerCredentials; compact?: boolean }) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [feed, setFeed] = useState<Shoutout[]>([]);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase
      .from("shoutout_presets")
      .select("id, text, price_cents")
      .order("sort")
      .then(({ data }) => data && setPresets(data));
  }, []);

  const refresh = useCallback(() => {
    supabase.rpc("get_shoutouts", { p_room_id: roomId }).then(({ data }) => data && setFeed(data));
  }, [roomId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  async function send(presetId: string) {
    setSending(true);
    setNote(null);
    const { error } = await supabase.rpc("send_shoutout", {
      p_room_id: roomId,
      p_player_id: creds.playerId,
      p_client_token: creds.clientToken,
      p_preset_id: presetId,
    });
    setSending(false);
    if (error) {
      const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
      setNote(key ? ERRORS[key] : "Couldn't send that. Try again.");
      return;
    }
    setOpen(false);
    setNote("Sent! It shows up for everyone in a few seconds.");
    setTimeout(() => setNote(null), 4000);
  }

  const shown = feed.slice(0, compact ? 2 : 4);

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white/5 border border-white/10 p-3 text-left">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-widest text-slate-400">Shoutouts</p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-xs font-bold rounded-full bg-amber-400/15 text-amber-300 px-3 py-1 active:scale-95"
        >
          {open ? "Close" : "📣 Send one"}
        </button>
      </div>

      {open && (
        <div className="flex flex-wrap gap-2 mt-2">
          {presets
            .filter((p) => p.price_cents === 0)
            .map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={sending}
                onClick={() => send(p.id)}
                className="rounded-full bg-white/10 px-3 py-1.5 text-sm active:scale-95 disabled:opacity-40"
              >
                {p.text}
              </button>
            ))}
        </div>
      )}
      {note && <p className="text-xs text-amber-300/90 mt-2">{note}</p>}

      {shown.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1.5">
          {shown.map((s) => (
            <li key={s.o_id} className="flex items-center gap-2 text-sm">
              <Avatar emoji={s.o_emoji} imageUrl={s.o_image_url} size={22} />
              <span className="min-w-0">
                <span className="font-semibold">{s.o_nickname}</span>
                {s.o_team_name && <span className="text-slate-500"> ({s.o_team_name})</span>}{" "}
                <span className="text-slate-200">{s.o_text}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        !open && <p className="text-xs text-slate-500 mt-1">No shoutouts yet. Start the hype.</p>
      )}
    </div>
  );
}
