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

/**
 * Bingo: Solo (your own card) or Team Play (teams of 4 share one card).
 * One tap finds the open game at this bar and joins it.
 */
export default function BingoLandingClient() {
  const router = useRouter();
  const venue = usePlayerVenue();
  const [busy, setBusy] = useState<null | "solo" | "team">(null);
  const [error, setError] = useState<string | null>(null);

  async function go(mode: "solo" | "team") {
    setBusy(mode);
    setError(null);
    const { data, error: err } = await supabase.rpc("sb_open", { p_venue: venue ?? "main", p_mode: mode });
    const code = data?.[0]?.o_code;
    if (err || !code) {
      setBusy(null);
      setError("Couldn't find a game. Try again.");
      return;
    }
    router.push(`/bingo/play/${code}`);
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white px-4 py-8 text-center">
      <Link href="/" className="absolute top-4 left-4 text-sm text-indigo-300/70 hover:text-indigo-200">
        ← Games
      </Link>
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight">Bingo</h1>
        <LevelChip bar />
      </div>
      <VenueBanner />
      <AccountLink />
      <MyCharacterButton />

      <div className="flex flex-col gap-4 w-full max-w-sm">
        <p className="text-sm text-slate-300">
          Numbers are called every few seconds. Tap them on your card. First full line, row, column or diagonal, wins.
        </p>

        <div className="rounded-3xl bg-amber-400/10 border border-amber-400/40 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-center gap-2">
            <Icon name="user" size={22} className="text-amber-300" />
            <h2 className="text-2xl font-black">Solo</h2>
          </div>
          <p className="text-base font-bold text-white">Your own card against everyone else.</p>
          <p className="text-sm text-slate-300">Join any time, even mid-game.</p>
          <button
            onClick={() => go("solo")}
            disabled={busy !== null}
            className="rounded-2xl bg-amber-400 text-black font-black text-xl py-5 shadow-lg shadow-amber-400/30 disabled:opacity-50 active:scale-95 transition"
          >
            {busy === "solo" ? "Finding a game…" : "Play Solo"}
          </button>
        </div>

        <div className="rounded-3xl bg-white/5 border border-white/15 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-center gap-2">
            <Icon name="users" size={22} className="text-sky-300" />
            <h2 className="text-2xl font-black">Team Play</h2>
          </div>
          <p className="text-base font-bold text-white">Teams of up to 4 share one card. Anyone can mark it.</p>
          <p className="text-xs text-slate-400">Invite friends with your team&apos;s QR code. Empty seats are filled by computer players.</p>
          <button
            onClick={() => go("team")}
            disabled={busy !== null}
            className="rounded-2xl bg-sky-400 text-black font-black text-lg py-4 disabled:opacity-50 active:scale-95 transition"
          >
            {busy === "team" ? "Finding a game…" : "Start a Team"}
          </button>
        </div>
        {error && <p className="text-sm font-bold text-rose-300">{error}</p>}
      </div>
    </main>
  );
}
