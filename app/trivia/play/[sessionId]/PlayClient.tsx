"use client";

import * as React from "react";
import Link from "next/link";
import { getTriviaBrowserClient } from "@/app/lib/trivia/supabaseBrowser";
import { getRememberedPlayer } from "@/app/lib/trivia/deviceId";
import type { PublicQuestion, SessionPhase } from "@/app/lib/trivia/types";

interface AnswerResult {
  questionId: string;
  choiceIndex: number;
  isCorrect: boolean;
  points: number;
}

export function PlayClient({ sessionId }: { sessionId: string }) {
  const [playerId, setPlayerId] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<SessionPhase>("lobby");
  const [question, setQuestion] = React.useState<PublicQuestion | null>(null);
  const [score, setScore] = React.useState(0);
  const [answer, setAnswer] = React.useState<AnswerResult | null>(null);
  const [pending, setPending] = React.useState(false);

  // Resolve who "you" are (set at join time).
  React.useEffect(() => {
    setPlayerId(getRememberedPlayer(sessionId));
  }, [sessionId]);

  // Pull the current question + phase from the server (strips the answer).
  const refreshQuestion = React.useCallback(async () => {
    const res = await fetch(`/api/trivia/question?sessionId=${sessionId}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data: { question: PublicQuestion | null; phase: SessionPhase } =
      await res.json();
    setPhase(data.phase);
    setQuestion(data.question);
    // Clear the local answer when a new question opens.
    setAnswer((prev) =>
      prev && data.question && prev.questionId === data.question.id ? prev : null,
    );
  }, [sessionId]);

  const refreshScore = React.useCallback(async () => {
    if (!playerId) return;
    const supabase = getTriviaBrowserClient();
    const { data } = await supabase
      .from("session_players")
      .select("score")
      .eq("session_id", sessionId)
      .eq("player_id", playerId)
      .maybeSingle();
    if (data) setScore(data.score ?? 0);
  }, [sessionId, playerId]);

  // Realtime: react to the host advancing the game and to score changes.
  React.useEffect(() => {
    refreshQuestion();
    refreshScore();

    const supabase = getTriviaBrowserClient();
    const channel = supabase
      .channel(`play-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        () => refreshQuestion(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_players",
          filter: `session_id=eq.${sessionId}`,
        },
        () => refreshScore(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, refreshQuestion, refreshScore]);

  async function submitAnswer(choiceIndex: number) {
    if (!playerId || !question || answer || pending || phase !== "question") return;
    setPending(true);
    try {
      const res = await fetch("/api/trivia/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, playerId, choiceIndex }),
      });
      const data = await res.json();
      if (res.ok) {
        setAnswer({
          questionId: question.id,
          choiceIndex,
          isCorrect: data.isCorrect,
          points: data.points,
        });
      }
    } finally {
      setPending(false);
    }
  }

  // ── Not joined ──
  if (playerId === null) {
    return (
      <Shell>
        <p className="text-white/80 font-medium">You&apos;re not in this game</p>
        <p className="text-sm text-white/50 mt-1">
          Scan the QR code at your table to join.
        </p>
        <Link href="/trivia" className="text-[#00E5C4] underline text-sm mt-4 inline-block">
          Back
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center justify-between mb-6">
        <span className="text-xs uppercase tracking-[0.2em] text-[#00E5C4]">
          Live Trivia
        </span>
        <span className="text-sm text-white/60">
          Score <span className="font-bold text-white tabular-nums">{score}</span>
        </span>
      </div>

      {phase === "lobby" && (
        <Waiting
          title="You're in!"
          subtitle="Waiting for the host to start the game…"
        />
      )}

      {phase === "ended" && (
        <div className="text-center py-8">
          <h1 className="text-2xl font-bold">That&apos;s a wrap 🎉</h1>
          <p className="text-white/60 mt-2">
            Final score: <span className="font-bold text-white">{score}</span>
          </p>
          <p className="text-sm text-white/40 mt-4">
            Check the big screen for the final leaderboard.
          </p>
        </div>
      )}

      {(phase === "question" || phase === "reveal") && question && (
        <div>
          <p className="text-xs text-white/40 mb-2">
            Question {question.index + 1}
            {question.category ? ` · ${question.category}` : ""}
          </p>
          <h1 className="text-xl font-semibold leading-snug mb-5">
            {question.prompt}
          </h1>

          <div className="space-y-3">
            {question.choices.map((choice, i) => {
              const chosen = answer?.choiceIndex === i;
              const isRevealCorrect =
                phase === "reveal" && question.correct_index === i;
              const isRevealWrongChosen =
                phase === "reveal" && chosen && question.correct_index !== i;

              let cls =
                "w-full text-left rounded-xl border px-4 py-4 text-base transition ";
              if (isRevealCorrect) {
                cls += "border-emerald-400 bg-emerald-400/15 text-white";
              } else if (isRevealWrongChosen) {
                cls += "border-red-400/60 bg-red-400/10 text-white/80";
              } else if (chosen) {
                cls += "border-[#00E5C4] bg-[#00E5C4]/15 text-white";
              } else {
                cls +=
                  "border-white/15 bg-white/5 text-white/90 active:scale-[0.99]";
              }

              return (
                <button
                  key={i}
                  onClick={() => submitAnswer(i)}
                  disabled={!!answer || phase !== "question" || pending}
                  className={cls}
                >
                  {choice}
                </button>
              );
            })}
          </div>

          {phase === "question" && answer && (
            <p className="text-center text-sm text-white/60 mt-5">
              Locked in — waiting for the reveal…
            </p>
          )}
          {phase === "question" && !answer && (
            <p className="text-center text-sm text-white/40 mt-5">
              Tap your answer. Faster answers score more.
            </p>
          )}
          {phase === "reveal" && answer && (
            <p
              className={`text-center text-sm mt-5 font-medium ${
                answer.isCorrect ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {answer.isCorrect
                ? `Correct! +${answer.points}`
                : "Not this time — get the next one."}
            </p>
          )}
          {phase === "reveal" && !answer && (
            <p className="text-center text-sm text-white/40 mt-5">
              No answer logged for this one.
            </p>
          )}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#080D1A] text-white px-5 py-6">
      <div className="max-w-sm mx-auto">{children}</div>
    </main>
  );
}

function Waiting({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center py-10">
      <div className="mx-auto mb-5 h-10 w-10 rounded-full border-2 border-white/15 border-t-[#00E5C4] animate-spin" />
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-white/60 mt-2">{subtitle}</p>
    </div>
  );
}
