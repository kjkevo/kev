import Link from "next/link";
import { getTriviaAdminClient } from "@/app/lib/trivia/supabaseAdmin";
import { JoinForm } from "./JoinForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Screen 1 — QR scan landing / join.
// The QR code at a venue points here: /trivia/j/<qr_token>
export default async function JoinPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;
  const db = getTriviaAdminClient();

  const { data: venue } = await db
    .from("venues")
    .select("id, name, address, active_session_id")
    .eq("qr_token", token)
    .maybeSingle();

  let phase: string | null = null;
  if (venue?.active_session_id) {
    const { data: session } = await db
      .from("sessions")
      .select("phase")
      .eq("id", venue.active_session_id)
      .maybeSingle();
    phase = session?.phase ?? null;
  }

  const gameLive = Boolean(venue?.active_session_id) && phase !== "ended";

  return (
    <main className="min-h-screen bg-[#080D1A] text-white flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-[#00E5C4] font-medium mb-3">
          Live Trivia
        </p>

        {!venue ? (
          <Unknown />
        ) : !gameLive ? (
          <NoGame venueName={venue.name} />
        ) : (
          <>
            <h1 className="text-3xl font-bold leading-tight">
              You&apos;re at <span className="text-[#00E5C4]">{venue.name}</span>
            </h1>
            {venue.address ? (
              <p className="text-sm text-white/50 mt-1">{venue.address}</p>
            ) : null}
            <p className="text-white/70 mt-4 mb-6">
              Trivia is live. Pick a name and jump in — you&apos;ll see the
              questions on your phone and the leaderboard on the big screen.
            </p>
            <JoinForm token={token} />
          </>
        )}
      </div>

      <p className="text-[11px] text-white/30 mt-10">Powered by Trivia MVP</p>
    </main>
  );
}

function NoGame({ venueName }: { venueName: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold">{venueName}</h1>
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-white/80 font-medium">No game running right now</p>
        <p className="text-sm text-white/50 mt-1">
          Hang tight — trivia will start soon. Try scanning again once the host
          kicks things off.
        </p>
      </div>
    </div>
  );
}

function Unknown() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Hmm, we can&apos;t find that venue</h1>
      <p className="text-sm text-white/50 mt-2">
        The QR code may be out of date. Ask a staff member for the current code.
      </p>
      <Link
        href="/trivia"
        className="inline-block mt-6 text-sm text-[#00E5C4] underline"
      >
        Back
      </Link>
    </div>
  );
}
