"use client";

import { Avatar } from "@/components/Avatar";
import type { AvatarOption } from "@/hooks/useAvatars";
import type { Player } from "@/lib/types";

/**
 * Everyone real in the lobby, character by character, with "Ready" above
 * each one who has tapped it. On your phone the spot above your own
 * character is the Ready button. When everyone is ready the game starts in
 * 5 seconds; otherwise the countdown runs as usual.
 */
export function ReadyLineup({
  players,
  avatars,
  myId,
  onToggleReady,
  busy = false,
  big = false,
}: {
  players: Player[];
  avatars: Record<string, AvatarOption>;
  myId?: string;
  onToggleReady?: (ready: boolean) => void;
  busy?: boolean;
  big?: boolean;
}) {
  const real = players.filter((p) => !p.left_at && !p.is_bot);
  if (real.length === 0) return null;
  // You first, then everyone else in the order they arrived.
  const ordered = [...real.filter((p) => p.id === myId), ...real.filter((p) => p.id !== myId)];
  const readyCount = real.filter((p) => p.ready).length;
  const size = big ? 110 : 64;

  return (
    <div className="w-full">
      <p className={`text-center font-bold text-slate-300 ${big ? "text-2xl mb-4" : "text-sm mb-2"}`}>
        <span className="text-emerald-300">{readyCount}</span> of {real.length} ready
        <span className={`block font-normal text-slate-400 ${big ? "text-lg" : "text-xs"}`}>
          {readyCount === real.length ? "Everyone's ready. It starts once everyone has voted on a category." : "Tap Ready and vote on a category. When everyone has, the game starts (or when the clock runs out)."}
        </span>
      </p>
      <div className={`flex flex-wrap justify-center ${big ? "gap-6" : "gap-3"}`}>
        {ordered.map((p) => {
          const a = p.avatar_id ? avatars[p.avatar_id] : undefined;
          const mine = p.id === myId;
          return (
            <div key={p.id} className="flex flex-col items-center gap-1">
              {mine && onToggleReady ? (
                <button
                  type="button"
                  onClick={() => onToggleReady(!p.ready)}
                  disabled={busy}
                  className={`rounded-full font-black px-4 py-1.5 text-sm transition active:scale-95 disabled:opacity-60 ${
                    p.ready ? "bg-emerald-400 text-black" : "bg-amber-400 text-black animate-pulse"
                  }`}
                >
                  {p.ready ? "Ready ✓" : "Tap: I'm ready"}
                </button>
              ) : (
                <span
                  className={`rounded-full font-bold ${big ? "px-4 py-1 text-lg" : "px-2.5 py-0.5 text-[11px]"} ${
                    p.ready ? "bg-emerald-400 text-black" : "bg-white/10 text-slate-400"
                  }`}
                >
                  {p.ready ? "Ready" : "Not ready"}
                </span>
              )}
              <Avatar
                emoji={a?.emoji}
                imageUrl={a?.imageUrl}
                size={mine && !big ? 88 : size}
                variant="full"
                className={p.ready ? "" : "opacity-60"}
              />
              <span className={`truncate text-center font-semibold ${big ? "text-lg w-36" : "text-xs w-20"} ${mine ? "text-amber-300" : "text-slate-200"}`}>
                {mine ? "You" : p.nickname}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
