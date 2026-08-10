import { getTriviaAdminClient } from "@/app/lib/trivia/supabaseAdmin";
import { HostClient } from "./HostClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Host controls — drives the live game. Unguarded in v1 (see out-of-scope).
export default async function HostPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const db = getTriviaAdminClient();

  const { data: session } = await db
    .from("sessions")
    .select("id, phase, current_question_index, venue_id, venues(name, qr_token)")
    .eq("id", params.sessionId)
    .maybeSingle();

  if (!session) {
    return (
      <main className="min-h-screen bg-[#080D1A] text-white grid place-items-center">
        <p className="text-white/60">Session not found.</p>
      </main>
    );
  }

  const venue = session.venues as unknown as {
    name?: string;
    qr_token?: string;
  } | null;

  return (
    <HostClient
      sessionId={session.id as string}
      venueName={venue?.name ?? "Venue"}
      qrToken={venue?.qr_token ?? ""}
      initialPhase={session.phase as string}
      initialIndex={(session.current_question_index as number) ?? 0}
    />
  );
}
