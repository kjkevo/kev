"use client";

import { Avatar } from "@/components/Avatar";
import type { AvatarOption } from "@/hooks/useAvatars";
import type { SuddenDeathResult } from "@/lib/types";

/** Who got the last sudden death question right and wrong. */
export function SuddenDeathResultList({
  result,
  avatars,
  big = false,
}: {
  result: SuddenDeathResult;
  avatars: Record<string, AvatarOption>;
  big?: boolean;
}) {
  return (
    <div className={`w-full flex flex-col gap-2 ${big ? "max-w-3xl" : "max-w-sm"}`}>
      <p className={`text-slate-400 ${big ? "text-xl" : "text-xs uppercase tracking-widest"}`}>
        Round {result.round} · answer: <span className="text-emerald-400 font-bold">{result.correct_answer}</span>
      </p>
      {result.players.map((p) => {
        const a = p.avatar_id ? avatars[p.avatar_id] : undefined;
        return (
          <div
            key={p.player_id}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left border ${
              p.correct ? "bg-emerald-500/15 border-emerald-400/50" : "bg-rose-500/15 border-rose-400/50"
            }`}
          >
            <Avatar emoji={a?.emoji} imageUrl={a?.imageUrl} size={big ? 56 : 36} />
            <div className="flex-1 min-w-0">
              <p className={`font-bold truncate ${big ? "text-2xl" : ""}`}>
                {p.nickname} <span className="text-slate-400 font-normal">· {p.team_name}</span>
              </p>
              <p className={`truncate ${big ? "text-xl" : "text-sm"} ${p.correct ? "text-emerald-300" : "text-rose-300"}`}>
                {p.answer ?? "No answer"}
              </p>
            </div>
            <span className={big ? "text-4xl" : "text-2xl"}>{p.correct ? "✓" : "✗"}</span>
          </div>
        );
      })}
    </div>
  );
}
