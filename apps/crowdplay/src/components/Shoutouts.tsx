"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/components/Avatar";
import type { PlayerCredentials } from "@/lib/types";

type Preset = { o_preset_id: string; o_text: string; o_left: number };
type Shoutout = { o_id: number; o_text: string; o_nickname: string; o_team_name: string | null; o_emoji: string | null; o_image_url: string | null };

const ERRORS: Record<string, string> = {
  SHOUTOUT_TOO_SOON: "Give it 10 seconds between shoutouts.",
  SHOUTOUTS_OFF: "Shoutouts are switched off here right now.",
  SHOUTOUT_USED_UP: "You've used that one 3 times this game.",
};

/**
 * The shoutout strip on a player's phone: the latest shoutouts from the
 * room, and the same 5 presets for everyone (encouraging to teasing), each
 * usable 3 times per game. Sent shoutouts appear for everyone after a
 * 10-second delay (and on the venue's /qr carousel).
 */
export function Shoutouts({ roomId, creds, compact = false }: { roomId: string; creds: PlayerCredentials; compact?: boolean }) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [feed, setFeed] = useState<Shoutout[]>([]);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const loadPresets = useCallback(() => {
    supabase
      .rpc("my_shoutouts_left", { p_room_id: roomId, p_player_id: creds.playerId, p_client_token: creds.clientToken })
      .then(({ data }) => data && setPresets(data));
  }, [roomId, creds.playerId, creds.clientToken]);

  useEffect(loadPresets, [loadPresets]);

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
    loadPresets();
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
          {open ? "Close" : "Send a shoutout"}
        </button>
      </div>

      {open && (
        <div className="flex flex-wrap gap-2 mt-2">
          {presets.map((p) => (
            <button
              key={p.o_preset_id}
              type="button"
              disabled={sending || p.o_left <= 0}
              onClick={() => send(p.o_preset_id)}
              className="rounded-full bg-white/10 px-3 py-1.5 text-sm active:scale-95 disabled:opacity-40"
            >
              {p.o_text}
              <span className="ml-1.5 text-[11px] text-slate-400">{p.o_left > 0 ? `${p.o_left} left` : "used up"}</span>
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
