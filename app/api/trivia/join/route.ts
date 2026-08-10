import { NextResponse } from "next/server";
import { getTriviaAdminClient } from "@/app/lib/trivia/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/trivia/join
// Body: { token: string, displayName: string, deviceId: string }
// Resolves the venue's live session, creates/updates the player, joins them to
// the session, and records the venue visit. Returns { sessionId, playerId }.
export async function POST(req: Request) {
  let body: { token?: string; displayName?: string; deviceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const token = (body.token ?? "").trim();
  const displayName = (body.displayName ?? "").trim().slice(0, 40);
  const deviceId = (body.deviceId ?? "").trim();

  if (!token || !displayName || !deviceId) {
    return NextResponse.json(
      { error: "token, displayName and deviceId are required." },
      { status: 400 },
    );
  }

  const db = getTriviaAdminClient();

  // 1. Resolve the venue + its active session.
  const { data: venue, error: venueErr } = await db
    .from("venues")
    .select("id, name, active_session_id")
    .eq("qr_token", token)
    .maybeSingle();

  if (venueErr) {
    return NextResponse.json({ error: venueErr.message }, { status: 500 });
  }
  if (!venue) {
    return NextResponse.json({ error: "Unknown venue." }, { status: 404 });
  }
  if (!venue.active_session_id) {
    return NextResponse.json(
      { error: "No game is running at this venue right now." },
      { status: 409 },
    );
  }

  const sessionId = venue.active_session_id as string;

  // 2. Upsert the player by device id (keeps score across a game; updates name).
  const { data: player, error: playerErr } = await db
    .from("players")
    .upsert(
      { device_id: deviceId, display_name: displayName },
      { onConflict: "device_id" },
    )
    .select("id")
    .single();

  if (playerErr || !player) {
    return NextResponse.json(
      { error: playerErr?.message ?? "Could not create player." },
      { status: 500 },
    );
  }

  // 3. Join the session (idempotent — re-joining keeps the existing score).
  const { error: spErr } = await db
    .from("session_players")
    .upsert(
      { session_id: sessionId, player_id: player.id },
      { onConflict: "session_id,player_id", ignoreDuplicates: true },
    );

  if (spErr) {
    return NextResponse.json({ error: spErr.message }, { status: 500 });
  }

  // 4. Record the venue visit (cross-session history for future streaks).
  //    First visit inserts; return visits bump the count + timestamp.
  const { data: existingVisit } = await db
    .from("venue_players")
    .select("visit_count")
    .eq("venue_id", venue.id)
    .eq("player_id", player.id)
    .maybeSingle();

  if (existingVisit) {
    await db
      .from("venue_players")
      .update({
        visit_count: (existingVisit.visit_count ?? 0) + 1,
        last_visit_at: new Date().toISOString(),
      })
      .eq("venue_id", venue.id)
      .eq("player_id", player.id);
  } else {
    await db.from("venue_players").insert({
      venue_id: venue.id,
      player_id: player.id,
      visit_count: 1,
      last_visit_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    sessionId,
    playerId: player.id,
    venueName: venue.name,
  });
}
