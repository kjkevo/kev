/* eslint-disable @next/next/no-img-element -- small static game icon */
import Link from "next/link";
import { MyCharacterButton } from "@/components/CharacterLocker";
import { MonthlyChampion } from "@/components/MonthlyChampion";
import { ScanCards } from "@/components/ScanCards";
import { Icon } from "@/components/Icon";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white px-4 py-8 text-center">
      <div>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight">
          Slim<span className="text-amber-400">pse</span>
        </h1>
        <p className="mt-2 text-sm sm:text-lg text-indigo-200">Pick a game, no app, no login.</p>
      </div>

      <MyCharacterButton />

      <div className="w-full max-w-sm flex flex-col gap-3">
        {/* The games, side by side: Trivia (live) and Mixer (coming soon). */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/trivia"
            className="rounded-3xl bg-amber-400 text-black p-4 flex flex-col items-center gap-2 shadow-lg shadow-amber-400/25 transition active:scale-95"
          >
            <div className="w-16 h-16 rounded-2xl bg-black overflow-hidden">
              <img src="/games/trivia.png" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="font-black text-2xl leading-tight">Trivia</div>
            <div className="text-xs font-bold text-black/70">Play now ›</div>
          </Link>
          <div className="rounded-3xl bg-white/[0.06] border border-white/15 p-4 flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-2xl bg-black/40 flex items-center justify-center text-pink-300">
              <Icon name="users" size={34} />
            </div>
            <div className="font-black text-2xl leading-tight">Mixer</div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Coming soon</div>
          </div>
        </div>

        <MonthlyChampion />
      </div>

      {/* On a laptop or TV: codes people can scan with their phones. */}
      <div className="hidden md:flex flex-col items-center gap-3 mt-4">
        <p className="text-sm uppercase tracking-widest text-indigo-200">Or scan with your phone camera</p>
        <ScanCards venue="main" />
      </div>
    </main>
  );
}
