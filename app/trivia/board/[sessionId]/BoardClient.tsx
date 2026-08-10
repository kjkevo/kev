"use client";

import * as React from "react";
import { getTriviaBrowserClient } from "@/app/lib/trivia/supabaseBrowser";
import type { LeaderboardRow, SessionPhase } from "@/app/lib/trivia/types";

export function BoardClient({ sessionId }: { sessionId: string }) {
  const [rows, setRows] = React.useState<LeaderboardRow[]>([]);
  const [venueName, setVenueName] = React.useState<string>("");
  const [phase, setPhase] = React.useState<SessionPhase>("lobby");
  const [questionIndex, setQuestionIndex] = React.useState(0);

  const loadLeaderboard = React.useCallback(async () => {
    const supabase = getTriviaBrowserClient();
    const { data } = await supabase
      .from("session_players")
      .select("player_id, score, players(display_name)")
      .eq("session_id", sessionId)
      .order("score", { ascending: false });

    if (data) {
      const mapped: LeaderboardRow[] = data.map((r) => {
        // players is returned as a nested object for a to-one relationship.
        const p = r.players as unknown as { display_name?: string } | null;
        return {
          player_id: r.player_id as string,
          display_name: p?.display_name ?? "Player",
          score: (r.score as number) ?? 0,
        };
      });
      setRows(mapped);
    }
  }, [sessionId]);

  const loadSession = React.useCallback(async () => {
    const supabase = getTriviaBrowserClient();
    const { data } = await supabase
      .from("sessions")
      .select("phase, current_question_index, venue_id, venues(name)")
      .eq("id", sessionId)
      .maybeSingle();
    if (data) {
      setPhase(data.phase as SessionPhase);
      setQuestionIndex((data.current_question_index as number) ?? 0);
      const v = data.venues as unknown as { name?: string } | null;
      if (v?.name) setVenueName(v.name);
    }
  }, [sessionId]);

  React.useEffect(() => {
    loadLeaderboard();
    loadSession();

    const supabase = getTriviaBrowserClient();
    const channel = supabase
      .channel(`board-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_players",
          filter: `session_id=eq.${sessionId}`,
        },
        () => loadLeaderboard(),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        () => loadSession(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, loadLeaderboard, loadSession]);

  const status =
    phase === "lobby"
      ? "Waiting to start"
      : phase === "ended"
        ? "Final results"
        : `Question ${questionIndex + 1}`;

  return (
    <main className="min-h-screen bg-[#080D1A] text-white px-8 py-8">
      <header className="flex items-end justify-between border-b border-white/10 pb-5 mb-6">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-[#00E5C4]">
            Live Trivia
          </p>
          <h1 className="text-4xl md:text-5xl font-bold mt-1">
            {venueName || "Leaderboard"}
          </h1>
        </div>
        <div className="text-right">
          <p className="text-2xl md:text-3xl font-semibold">{status}</p>
          <p className="text-white/40 text-sm mt-1">
            {rows.length} player{rows.length === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-3xl font-semibold text-white/80">
            Scan to join 📲
          </p>
          <p className="text-white/40 mt-2 text-lg">
            Players appear here as they join the game.
          </p>
        </div>
      ) : (
        <ol className="space-y-3">
          {rows.map((row, i) => (
            <li
              key={row.player_id}
              className={`flex items-center gap-5 rounded-2xl px-6 py-4 transition-all duration-300 ${
                i === 0
                  ? "bg-[#00E5C4]/15 border border-[#00E5C4]/40"
                  : "bg-white/5 border border-white/10"
              }`}
            >
              <span
                className={`w-12 text-3xl md:text-4xl font-bold tabular-nums ${
                  i === 0 ? "text-[#00E5C4]" : "text-white/40"
                }`}
              >
                {i + 1}
              </span>
              <span className="flex-1 text-2xl md:text-3xl font-semibold truncate">
                {row.display_name}
              </span>
              <span className="text-3xl md:text-4xl font-bold tabular-nums">
                {row.score.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
