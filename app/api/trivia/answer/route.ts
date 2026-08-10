import { NextResponse } from "next/server";
import { getTriviaAdminClient } from "@/app/lib/trivia/supabaseAdmin";
import { scoreForAnswer } from "@/app/lib/trivia/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/trivia/answer
// Body: { sessionId, playerId, choiceIndex }
// Records the player's answer to the currently-open question, scores it, and
// bumps their session + venue totals. The unique (session,player,question)
// constraint guarantees a question is scored at most once per player.
export async function POST(req: Request) {
  let body: { sessionId?: string; playerId?: string; choiceIndex?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { sessionId, playerId } = body;
  const choiceIndex = body.choiceIndex;

  if (!sessionId || !playerId || typeof choiceIndex !== "number") {
    return NextResponse.json(
      { error: "sessionId, playerId and choiceIndex are required." },
      { status: 400 },
    );
  }

  const db = getTriviaAdminClient();

  // Session must have a question open.
  const { data: session, error: sErr } = await db
    .from("sessions")
    .select("id, venue_id, phase, current_question_id, question_started_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  if (!session) {
    return NextResponse.json({ error: "Unknown session." }, { status: 404 });
  }
  if (session.phase !== "question" || !session.current_question_id) {
    return NextResponse.json(
      { error: "No question is open right now." },
      { status: 409 },
    );
  }

  // Player must be in this game.
  const { data: sp } = await db
    .from("session_players")
    .select("score")
    .eq("session_id", sessionId)
    .eq("player_id", playerId)
    .maybeSingle();

  if (!sp) {
    return NextResponse.json(
      { error: "You have not joined this game." },
      { status: 403 },
    );
  }

  // Grade against the (server-only) correct answer.
  const { data: q, error: qErr } = await db
    .from("questions")
    .select("correct_index, choices")
    .eq("id", session.current_question_id)
    .single();

  if (qErr || !q) {
    return NextResponse.json(
      { error: qErr?.message ?? "Question not found." },
      { status: 500 },
    );
  }

  const choices = q.choices as unknown[];
  if (choiceIndex < 0 || choiceIndex >= choices.length) {
    return NextResponse.json({ error: "Invalid choice." }, { status: 400 });
  }

  const isCorrect = choiceIndex === q.correct_index;
  const points = scoreForAnswer(isCorrect, session.question_started_at);

  // Insert the answer. A duplicate means they already answered this question.
  const { error: ansErr } = await db.from("answers").insert({
    session_id: sessionId,
    player_id: playerId,
    question_id: session.current_question_id,
    choice_index: choiceIndex,
    is_correct: isCorrect,
    points_awarded: points,
  });

  if (ansErr) {
    // 23505 = unique_violation → already answered.
    if ((ansErr as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "You already answered this question." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: ansErr.message }, { status: 500 });
  }

  // Bump session score (drives the live leaderboard) + venue lifetime points.
  if (points > 0) {
    await db
      .from("session_players")
      .update({ score: (sp.score ?? 0) + points })
      .eq("session_id", sessionId)
      .eq("player_id", playerId);

    const { data: vp } = await db
      .from("venue_players")
      .select("total_points")
      .eq("venue_id", session.venue_id)
      .eq("player_id", playerId)
      .maybeSingle();

    if (vp) {
      await db
        .from("venue_players")
        .update({ total_points: (vp.total_points ?? 0) + points })
        .eq("venue_id", session.venue_id)
        .eq("player_id", playerId);
    }
  }

  return NextResponse.json({ isCorrect, points });
}
