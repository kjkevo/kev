import Link from "next/link";
import { getTriviaAdminClient } from "@/app/lib/trivia/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Demo hub — a convenience index that surfaces the seeded venue's live session so
// you can open the host, the board, and a player join link during a demo.
export default async function TriviaIndex() {
  let venueName = "";
  let token = "";
  let sessionId: string | null = null;

  try {
    const db = getTriviaAdminClient();
    const { data: venue } = await db
      .from("venues")
      .select("name, qr_token, active_session_id")
      .eq("qr_token", "anchor-demo")
      .maybeSingle();
    if (venue) {
      venueName = venue.name;
      token = venue.qr_token;
      sessionId = venue.active_session_id;
    }
  } catch {
    // Env not configured yet — fall through to the setup hint below.
  }

  return (
    <main className="min-h-screen bg-[#080D1A] text-white px-6 py-12 flex flex-col items-center">
      <div className="w-full max-w-md">
        <p className="text-xs uppercase tracking-[0.25em] text-[#00E5C4]">
          Live Trivia — MVP
        </p>
        <h1 className="text-3xl font-bold mt-2">Demo hub</h1>

        {!sessionId ? (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
            <p className="font-medium text-white">Not set up yet</p>
            <p className="mt-1">
              Run the two SQL migrations in <code>supabase/migrations</code> and
              set the Supabase env vars. See{" "}
              <span className="text-[#00E5C4]">docs/TRIVIA_SETUP.md</span>.
            </p>
          </div>
        ) : (
          <>
            <p className="text-white/60 mt-2">{venueName}</p>
            <div className="mt-6 space-y-3">
              <NavCard
                href={`/trivia/host/${sessionId}`}
                title="Host controls →"
                desc="Start the game, reveal answers, advance questions."
              />
              <NavCard
                href={`/trivia/board/${sessionId}`}
                title="Wall leaderboard →"
                desc="The realtime big-screen display."
              />
              <NavCard
                href={`/trivia/j/${token}`}
                title="Player join →"
                desc="What a patron sees after scanning the QR code."
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function NavCard({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-[#00E5C4]/40 hover:bg-white/[0.07]"
    >
      <p className="font-semibold text-[#00E5C4]">{title}</p>
      <p className="text-sm text-white/50 mt-0.5">{desc}</p>
    </Link>
  );
}
