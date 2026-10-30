"use client";

import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { CharacterGate } from "@/components/CharacterGate";
import { powerFor } from "@/lib/powers";
import type { AvatarOption } from "@/hooks/useAvatars";

export const JOINED_BEFORE_KEY = "slimpse_joined_before";

type Step = "name" | "character" | "how";

/**
 * Getting a new phone into a trivia game, one clear step at a time:
 * pick a name, pick a character (each has a power), a quick how-it-works,
 * then straight into the lobby. A phone that has played before only
 * confirms its name; one with this month's name already joins on its own
 * (handled by the page), so it never sees these steps.
 */
export function JoinSteps({
  heading,
  timing,
  nickname,
  setNickname,
  nameStatus,
  rerollName,
  avatars,
  avatarId,
  onPickAvatar,
  playedBefore,
  joining,
  joinError,
  joinLabel,
  onJoin,
  soloGame = false,
}: {
  heading: string;
  timing?: ReactNode;
  nickname: string;
  setNickname: (name: string) => void;
  nameStatus: "checking" | "free" | "taken" | null;
  rerollName: () => void;
  avatars: AvatarOption[];
  avatarId: string | null;
  onPickAvatar: (id: string) => void;
  playedBefore: boolean;
  joining: boolean;
  joinError: string | null;
  joinLabel: string;
  onJoin: () => void;
  /** A solo game: everyone for themselves, join any time. */
  soloGame?: boolean;
}) {
  const steps: Step[] = playedBefore ? ["name"] : ["name", "character", "how"];
  const [step, setStep] = useState<Step>("name");
  const index = steps.indexOf(step);
  const last = index === steps.length - 1;
  const next = () => (last ? onJoin() : setStep(steps[index + 1]));
  const back = index > 0 ? () => setStep(steps[index - 1]) : null;
  const myAvatar = avatarId ? avatars.find((a) => a.id === avatarId) : undefined;
  const power = powerFor(avatarId);
  const nameOk = nickname.trim().length >= 2 && nameStatus !== "taken" && nameStatus !== "checking";

  return (
    <div className="w-full max-w-sm flex flex-col gap-4 pt-14 pb-8">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-2xl font-black">{heading}</h1>
        {timing}
        {steps.length > 1 && (
          <div className="flex items-center gap-2 mt-2" aria-label={`Step ${index + 1} of ${steps.length}`}>
            {steps.map((s, i) => (
              <span key={s} className={`h-1.5 rounded-full transition-all ${i === index ? "w-8 bg-amber-400" : i < index ? "w-4 bg-amber-400/60" : "w-4 bg-white/20"}`} />
            ))}
          </div>
        )}
      </div>

      {step === "name" && (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3 text-left">
          <p className="flex items-center justify-center gap-2 text-lg font-black">
            <Icon name="user" size={20} className="text-amber-300" />
            {playedBefore ? "Welcome back" : "Your name"}
          </p>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            aria-label="Your name"
            className="w-full text-center text-2xl font-black bg-white/10 border border-white/20 rounded-xl px-3 py-3 outline-none focus:border-amber-400"
          />
          <div className="flex items-center justify-between gap-2 min-h-[1.5rem]">
            <span className="text-xs font-bold">
              {nameStatus === "taken" ? (
                <span className="flex items-center gap-1 text-rose-300"><Icon name="x" size={14} />Taken</span>
              ) : nameStatus === "free" ? (
                <span className="flex items-center gap-1 text-emerald-300"><Icon name="check" size={14} />Yours</span>
              ) : nameStatus === "checking" ? (
                <span className="text-slate-400">Checking…</span>
              ) : null}
            </span>
            <button type="button" onClick={rerollName} className="text-xs font-bold text-amber-300 underline">
              New name
            </button>
          </div>
        </div>
      )}

      {step === "character" && (
        <div className="flex flex-col gap-2">
          <CharacterGate
            avatars={avatars}
            onPick={(id) => {
              onPickAvatar(id);
              setStep(steps[index + 1]);
            }}
          />
        </div>
      )}

      {step === "how" && (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3 text-left">
          <div className="flex items-center gap-3">
            <Avatar emoji={myAvatar?.emoji} imageUrl={myAvatar?.imageUrl} size={52} />
            <div className="min-w-0">
              <p className="text-lg font-black truncate">{nickname.trim()}</p>
              <p className="text-xs text-slate-400">{myAvatar?.name}</p>
            </div>
          </div>
          <ul className="flex flex-col gap-3 text-base font-semibold text-slate-100">
            <HowItem icon="clock">20 seconds per question</HowItem>
            <HowItem icon="bolt">Faster right answer = more points</HowItem>
            {power && (
              <HowItem icon="star">
                <span className="text-violet-200">{power.name}:</span> {power.how} (once)
              </HowItem>
            )}
            {soloGame ? (
              <HowItem icon="user">Everyone for themselves</HowItem>
            ) : (
              <HowItem icon="users">Teams of 4 · bots fill empty spots</HowItem>
            )}
            <HowItem icon="hand">Vote + tap Ready to start</HowItem>
          </ul>
        </div>
      )}

      {joinError && <p className="text-rose-300 text-sm text-center">{joinError}</p>}

      {step !== "character" && (
        <button
          type="button"
          onClick={next}
          disabled={joining || (step === "name" && !nameOk)}
          className="rounded-2xl bg-amber-400 text-black font-black text-xl py-4 shadow-lg shadow-amber-400/20 disabled:opacity-40 active:scale-95 transition"
        >
          {joining ? "Joining…" : last ? joinLabel : "Next"}
        </button>
      )}
      {back && (
        <button type="button" onClick={back} className="text-sm text-slate-400">
          ‹ Back
        </button>
      )}
    </div>
  );
}

function HowItem({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="shrink-0 w-9 h-9 rounded-full bg-amber-400 text-black flex items-center justify-center">
        <Icon name={icon} size={20} strokeWidth={2.4} />
      </span>
      <span>{children}</span>
    </li>
  );
}
