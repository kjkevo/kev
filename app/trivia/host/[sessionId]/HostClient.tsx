"use client";

import * as React from "react";
import Link from "next/link";
import { getTriviaBrowserClient } from "@/app/lib/trivia/supabaseBrowser";

type Phase = "lobby" | "question" | "reveal" | "ended";
type Action = "start" | "reveal" | "next" | "end" | "restart";

export function HostClient({
  sessionId,
  venueName,
  qrToken,
  initialPhase,
  initialIndex,
}: {
  sessionId: string;
  venueName: string;
  qrToken: string;
  initialPhase: string;
  initialIndex: number;
}) {
  const [phase, setPhase] = React.useState<Phase>(initialPhase as Phase);
  const [index, setIndex] = React.useState(initialIndex);
  const [busy, setBusy] = React.useState(false);
  const [origin, setOrigin] = React.useState("");

  React.useEffect(() => {
    setOrigin(window.location.origin);
    const supabase = getTriviaBrowserClient();
    const channel = supabase
      .channel(`host-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as { phase: Phase; current_question_index: number };
          setPhase(row.phase);
          setIndex(row.current_question_index);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  async function act(action: Action) {
    setBusy(true);
    try {
      const res = await fetch("/api/trivia/host", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action }),
      });
      const data = await res.json();
      if (res.ok && data.session) {
        setPhase(data.session.phase);
        setIndex(data.session.current_question_index);
      }
    } finally {
      setBusy(false);
    }
  }

  const joinUrl = origin ? `${origin}/trivia/j/${qrToken}` : "";
  const boardUrl = origin ? `${origin}/trivia/board/${sessionId}` : "";

  return (
    <main className="min-h-screen bg-[#080D1A] text-white px-6 py-8">
      <div className="max-w-lg mx-auto">
        <p className="text-xs uppercase tracking-[0.25em] text-[#00E5C4]">
          Host controls
        </p>
        <h1 className="text-3xl font-bold mt-1">{venueName}</h1>

        <div className="mt-5 flex items-center gap-3">
          <StatusPill phase={phase} />
          {(phase === "question" || phase === "reveal") && (
            <span className="text-white/50 text-sm">Question {index + 1}</span>
          )}
        </div>

        {/* Primary control changes with the phase. */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          {phase === "lobby" && (
            <Big onClick={() => act("start")} disabled={busy} span>
              ▶ Start game
            </Big>
          )}
          {phase === "question" && (
            <Big onClick={() => act("reveal")} disabled={busy} span>
              👁 Reveal answer
            </Big>
          )}
          {phase === "reveal" && (
            <Big onClick={() => act("next")} disabled={busy} span>
              ⏭ Next question
            </Big>
          )}
          {phase === "ended" && (
            <Big onClick={() => act("restart")} disabled={busy} span>
              ↻ Run it again
            </Big>
          )}

          {phase !== "lobby" && phase !== "ended" && (
            <>
              <Secondary onClick={() => act("end")} disabled={busy}>
                End game
              </Secondary>
              <Secondary onClick={() => act("restart")} disabled={busy}>
                Restart
              </Secondary>
            </>
          )}
        </div>

        {/* Links the host needs on hand. */}
        <div className="mt-8 space-y-4">
          <LinkCard
            label="Players join at"
            url={joinUrl}
            hint="Put this behind the venue's QR code."
          />
          <LinkCard
            label="Wall leaderboard"
            url={boardUrl}
            hint="Open on the big screen."
            openHref={`/trivia/board/${sessionId}`}
          />
        </div>
      </div>
    </main>
  );
}

function StatusPill({ phase }: { phase: Phase }) {
  const map: Record<Phase, { label: string; cls: string }> = {
    lobby: { label: "Lobby", cls: "bg-white/10 text-white/70" },
    question: { label: "Question open", cls: "bg-[#00E5C4]/20 text-[#00E5C4]" },
    reveal: { label: "Revealed", cls: "bg-amber-400/20 text-amber-300" },
    ended: { label: "Ended", cls: "bg-white/10 text-white/50" },
  };
  const s = map[phase];
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

function Big({
  children,
  onClick,
  disabled,
  span,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  span?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${span ? "col-span-2" : ""} rounded-xl bg-[#00E5C4] px-4 py-4 text-lg font-semibold text-[#04121F] active:scale-[0.99] disabled:opacity-60`}
    >
      {children}
    </button>
  );
}

function Secondary({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-medium text-white/80 active:scale-[0.99] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function LinkCard({
  label,
  url,
  hint,
  openHref,
}: {
  label: string;
  url: string;
  hint: string;
  openHref?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-1 font-mono text-sm text-[#00E5C4] break-all">
        {url || "…"}
      </p>
      <p className="mt-1 text-xs text-white/40">{hint}</p>
      {openHref && (
        <Link
          href={openHref}
          target="_blank"
          className="mt-2 inline-block text-sm text-white underline"
        >
          Open ↗
        </Link>
      )}
    </div>
  );
}
