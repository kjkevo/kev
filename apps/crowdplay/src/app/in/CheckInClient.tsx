"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkIn } from "@/lib/checkin";
import { rememberPlayerVenue } from "@/lib/venue";
import { Icon } from "@/components/Icon";

/** Where the bar TV's code lands: check in, then pick a game. */
export default function CheckInClient() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const venue = q.get("v") ?? "";
    const code = q.get("c") ?? "";
    if (!venue || !code) {
      setFailed(true);
      return;
    }
    checkIn(venue, code).then((ok) => {
      if (!ok) {
        setFailed(true);
        return;
      }
      rememberPlayerVenue(venue);
      // Straight to a game when the TV code was for one (same site only).
      const next = q.get("next");
      const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      router.replace(safe ?? `/?venue=${encodeURIComponent(venue)}`);
    });
  }, [router]);

  return (
    <main className="min-h-[100svh] flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white px-6 text-center">
      {failed ? (
        <>
          <div className="w-24 h-24 rounded-3xl bg-white/10 flex items-center justify-center text-amber-300">
            <Icon name="qr" size={52} />
          </div>
          <h1 className="text-4xl font-black">That code is old</h1>
          <p className="text-2xl font-bold text-slate-200">Scan the code on the TV again.</p>
        </>
      ) : (
        <p className="text-2xl font-bold text-slate-200">Checking you in…</p>
      )}
    </main>
  );
}
