"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { powerByKey, powerFace, powerResultLine, type PowerData } from "@/lib/powers";

/**
 * Your character's power on the question screen: a button while you can use
 * it (tap, then confirm), what it did once someone on your team used it, or
 * a quiet note once yours is spent.
 */
export function PowerPanel({
  myPower,
  myUsedQuestion,
  questionId,
  teamPower,
  usedByName,
  locked,
  answeredSolo,
  open,
  expired,
  fogged,
  choices,
  onUse,
}: {
  myPower: string | null;
  myUsedQuestion: string | null;
  questionId: string;
  teamPower: { power: string; playerId: string; data: PowerData } | null;
  usedByName: string;
  locked: boolean;
  /** Playing alone with an answer in: it counts as locked for Second Wind. */
  answeredSolo: boolean;
  open: boolean;
  expired: boolean;
  fogged: boolean;
  /** The choices in screen order, for Mind Probe's bars. */
  choices: string[];
  onUse: () => Promise<string | null>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [using, setUsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mine = powerByKey(myPower);

  if (teamPower) {
    const p = powerByKey(teamPower.power);
    if (!p) return null;
    const counts = teamPower.data.counts;
    const total = teamPower.data.total ?? 0;
    return (
      <div className="rounded-2xl bg-violet-500/15 border border-violet-400/50 px-4 py-2.5 text-center">
        <p className="text-xs uppercase tracking-widest text-violet-300 mb-1">
          {usedByName} used {p.name}
        </p>
        <p className="font-semibold">{powerResultLine(teamPower.power, teamPower.data)}</p>
        {teamPower.power === "probe" && counts && total > 0 && (
          <div className="mt-2 flex flex-col gap-1 text-left">
            {choices.map((c) => {
              const n = counts[c] ?? 0;
              const pct = Math.round((n / total) * 100);
              return (
                <div key={c} className="relative rounded-lg bg-white/5 overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-violet-400/40" style={{ width: `${pct}%` }} />
                  <div className="relative flex justify-between px-2 py-1 text-sm">
                    <span className="truncate font-semibold">{c}</span>
                    <span className="tabular-nums font-bold">{pct}%</span>
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] text-slate-400 text-center">{total} {total === 1 ? "vote" : "votes"} from other teams so far</p>
          </div>
        )}
      </div>
    );
  }

  if (!mine) return null;
  if (myUsedQuestion) {
    return (
      <p className="text-center text-xs text-slate-500">
        {mine.name} used{myUsedQuestion === questionId ? "" : " earlier this game"}
      </p>
    );
  }
  if (expired) return null;

  const reason =
    mine.choicesOnly && open
      ? "Works on multiple-choice questions only"
      : mine.timing === "before" && locked
        ? "Use it before your team locks in"
        : mine.timing === "after" && !locked && !answeredSolo
          ? "Lock in an answer first, then use it"
          : fogged
            ? "You're fogged!"
            : null;

  async function use() {
    setUsing(true);
    setError(null);
    const err = await onUse();
    setUsing(false);
    setConfirming(false);
    if (err) setError(err);
  }

  return (
    <div className="rounded-2xl bg-violet-500/10 border border-violet-400/40 px-3 py-2.5 text-center">
      {confirming && !reason ? (
        <>
          <p className="text-sm text-slate-200 mb-2">
            <span className="font-bold">{mine.name}:</span> {mine.how} You only get it once per game.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="flex-1 rounded-xl bg-white/10 py-2 font-semibold">
              Cancel
            </button>
            <button
              type="button"
              onClick={use}
              disabled={using}
              className="flex-1 rounded-xl bg-violet-400 text-black py-2 font-black disabled:opacity-50"
            >
              {using ? "Using…" : `Use ${mine.name}`}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={!!reason}
          className="w-full flex items-center gap-2 text-left disabled:opacity-50 active:scale-[0.98] transition"
        >
          <Avatar imageUrl={powerFace(mine.key)} size={36} />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-black text-violet-200">Power: {mine.name}</span>
            <span className="block text-xs text-slate-300 leading-snug">{reason ?? mine.how}</span>
          </span>
          {!reason && <span className="rounded-full bg-violet-400 text-black text-xs font-black px-3 py-1">Use</span>}
        </button>
      )}
      {error && <p className="mt-1 text-sm text-rose-300">{error}</p>}
    </div>
  );
}
