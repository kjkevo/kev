import { NextResponse } from "next/server";
import { getTriviaAdminClient } from "@/app/lib/trivia/supabaseAdmin";
import type { PublicQuestion } from "@/app/lib/trivia/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/trivia/question?sessionId=...
// Returns the current question for the session WITHOUT the correct answer —
// unless the session has revealed, in which case correct_index is included.
// This is why players read questions through the server and never from the
// (anon-readable) questions table directly.
export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required." }, { status: 400 });
  }

  const db = getTriviaAdminClient();

  const { data: session, error: sErr } = await db
    .from("sessions")
    .select("phase, current_question_id, current_question_index")
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  if (!session) {
    return NextResponse.json({ error: "Unknown session." }, { status: 404 });
  }

  // No active question (lobby / ended / between questions).
  if (!session.current_question_id) {
    return NextResponse.json({ question: null, phase: session.phase });
  }

  const { data: q, error: qErr } = await db
    .from("questions")
    .select("id, prompt, choices, category, correct_index")
    .eq("id", session.current_question_id)
    .single();

  if (qErr || !q) {
    return NextResponse.json(
      { error: qErr?.message ?? "Question not found." },
      { status: 500 },
    );
  }

  const revealed = session.phase === "reveal";
  const question: PublicQuestion = {
    id: q.id,
    prompt: q.prompt,
    choices: q.choices as string[],
    category: q.category,
    index: session.current_question_index,
    correct_index: revealed ? q.correct_index : null,
  };

  return NextResponse.json({ question, phase: session.phase });
}
