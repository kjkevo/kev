import { NextResponse } from "next/server";
import { getTriviaAdminClient } from "@/app/lib/trivia/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/trivia/host
// Body: { sessionId, action: "start" | "reveal" | "next" | "end" | "restart" }
//
// Drives one live game. Unguarded in v1 (see docs/TRIVIA_MVP.md out-of-scope).
export async function POST(req: Request) {
  let body: { sessionId?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { sessionId, action } = body;
  if (!sessionId || !action) {
    return NextResponse.json(
      { error: "sessionId and action are required." },
      { status: 400 },
    );
  }

  const db = getTriviaAdminClient();

  // The question bank, in play order. current_question_index is a position here.
  const { data: questions, error: qErr } = await db
    .from("questions")
    .select("id")
    .order("sort_order", { ascending: true });

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });
  const bank = (questions ?? []).map((q) => q.id as string);

  const { data: session, error: sErr } = await db
    .from("sessions")
    .select("id, current_question_index, phase")
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  if (!session) {
    return NextResponse.json({ error: "Unknown session." }, { status: 404 });
  }

  const now = new Date().toISOString();

  switch (action) {
    case "start": {
      if (bank.length === 0) {
        return NextResponse.json(
          { error: "No questions in the bank." },
          { status: 409 },
        );
      }
      await db
        .from("sessions")
        .update({
          phase: "question",
          current_question_index: 0,
          current_question_id: bank[0],
          question_started_at: now,
          started_at: now,
          ended_at: null,
        })
        .eq("id", sessionId);
      break;
    }

    case "reveal": {
      await db.from("sessions").update({ phase: "reveal" }).eq("id", sessionId);
      break;
    }

    case "next": {
      const nextIdx = session.current_question_index + 1;
      if (nextIdx >= bank.length) {
        await db
          .from("sessions")
          .update({ phase: "ended", current_question_id: null, ended_at: now })
          .eq("id", sessionId);
      } else {
        await db
          .from("sessions")
          .update({
            phase: "question",
            current_question_index: nextIdx,
            current_question_id: bank[nextIdx],
            question_started_at: now,
          })
          .eq("id", sessionId);
      }
      break;
    }

    case "end": {
      await db
        .from("sessions")
        .update({ phase: "ended", ended_at: now })
        .eq("id", sessionId);
      break;
    }

    case "restart": {
      // Wipe the game back to the lobby so it can be demoed again.
      await db.from("answers").delete().eq("session_id", sessionId);
      await db
        .from("session_players")
        .update({ score: 0 })
        .eq("session_id", sessionId);
      await db
        .from("sessions")
        .update({
          phase: "lobby",
          current_question_index: 0,
          current_question_id: null,
          question_started_at: null,
          started_at: null,
          ended_at: null,
        })
        .eq("id", sessionId);
      break;
    }

    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const { data: updated } = await db
    .from("sessions")
    .select("id, phase, current_question_index, current_question_id")
    .eq("id", sessionId)
    .single();

  return NextResponse.json({ session: updated });
}
