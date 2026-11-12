"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { usePlayerVenue } from "@/lib/venue";
import { Icon } from "@/components/Icon";
import { MyCharacterButton } from "@/components/CharacterLocker";
import { LevelChip } from "@/components/LevelChip";
import { AccountLink } from "@/components/AccountLink";
import { VenueBanner } from "@/components/VenueBanner";
import { useSeason } from "@/hooks/useSeason";

/**
 * Drop Line: Solo (1 vs 1) or Team Play (2 vs 2).
 * One tap finds the open game at this bar and joins it.
 */
export default function DropLineLandingClient() {
  const router = useRouter();
  const venue = usePlayerVenue();
  const { season } = useSeason(venue);
  const [busy, setBusy] = useState<null | string>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(mode: "solo" | "team", priv = false) {
    setBusy(priv ? `${mode}-friends` : mode);
    setError(null);
    const { data, error: err } = await supabase.rpc("dl_open", { p_venue: venue ?? "main", p_mode: mode, p_private: priv });
    const code = data?.[0]?.o_code;
    if (err || !code) {
      setBusy(null);
      setError("Couldn't find a game. Try again.");
      return;
    }
    router.push(`/drop-line/play/${code}`);
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white px-4 py-8 text-center">
      <Link href="/" className="absolute top-4 left-4 text-sm text-indigo-300/70 hover:text-indigo-200">
        ← Games
      </Link>
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight">Drop Line</h1>
        {season?.username && (
          <p className="text-sm text-indigo-200">
            Your name this month: <span className="font-bold text-white">{season.username}</span>
          </p>
        )}
        <LevelChip bar />
      </div>
      <VenueBanner />
      <AccountLink />
      <MyCharacterButton />

      <div className="flex flex-col gap-4 w-full max-w-sm">
        <div className="rounded-3xl bg-amber-400/10 border border-amber-400/40 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-center gap-2">
            <Icon name="user" size={22} className="text-amber-300" />
            <h2 className="text-2xl font-black">Solo</h2>
          </div>
          <p className="text-lg font-bold text-white">Just you.</p>
          <button
            onClick={() => go("solo")}
            disabled={busy !== null}
            className="rounded-2xl bg-amber-400 text-black font-black text-xl py-5 shadow-lg shadow-amber-400/30 disabled:opacity-50 active:scale-95 transition"
          >
            {busy === "solo" ? "Finding a game…" : "Play Solo"}
          </button>
          <button
            onClick={() => go("solo", true)}
            disabled={busy !== null}
            className="rounded-2xl bg-white/10 border border-white/25 text-white font-black text-lg py-3 disabled:opacity-50 active:scale-95 transition"
          >
            {busy === "solo-friends" ? "Making your table…" : "Private table"}
          </button>
        </div>

        <div className="rounded-3xl bg-white/5 border border-white/15 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-center gap-2">
            <Icon name="users" size={22} className="text-sky-300" />
            <h2 className="text-2xl font-black">Team Play</h2>
          </div>
          <p className="text-lg font-bold text-white">Play with friends.</p>
          <button
            onClick={() => go("team")}
            disabled={busy !== null}
            className="rounded-2xl bg-sky-400 text-black font-black text-lg py-4 disabled:opacity-50 active:scale-95 transition"
          >
            {busy === "team" ? "Finding a game…" : "Play other teams"}
          </button>
          <button
            onClick={() => go("team", true)}
            disabled={busy !== null}
            className="rounded-2xl bg-white/10 border border-white/25 text-white font-black text-lg py-3 disabled:opacity-50 active:scale-95 transition"
          >
            {busy === "team-friends" ? "Making your table…" : "Just my friends"}
          </button>
        </div>
        {error && <p className="text-sm font-bold text-rose-300">{error}</p>}
      </div>
    </main>
  );
}
