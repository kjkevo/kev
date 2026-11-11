/* eslint-disable @next/next/no-img-element -- small static game icon */
import Link from "next/link";
import { MonthlyChampion } from "@/components/MonthlyChampion";
import { Leaderboard } from "@/components/Leaderboard";
import { Icon } from "@/components/Icon";
import { GameScanTile } from "@/components/ScanCards";
import { VenueBanner } from "@/components/VenueBanner";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white px-4 py-8 text-center">
      <div>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight">
          Slim<span className="text-amber-400">pse</span>
        </h1>
        <p className="mt-2 text-sm sm:text-lg text-indigo-200">Pick a game. No app needed.</p>
      </div>

      {/* A bar's own logo, welcome line and prize (?venue=...). */}
      <VenueBanner />


      <div className="w-full max-w-sm flex flex-col gap-3">
        {/* The games: Trivia and Bingo are live; Wild Match and Drop Line are on the way. */}
        <div className="grid grid-cols-2 gap-3">
          {/* On a computer or TV the games show scan codes; on a phone they're tappable. */}
          <div className="hidden md:block">
            <GameScanTile title="Trivia" path="/trivia" accent="amber" />
          </div>
          <Link
            href="/trivia"
            className="md:hidden rounded-3xl bg-amber-400 text-black p-4 flex flex-col items-center gap-2 shadow-lg shadow-amber-400/25 transition active:scale-95"
          >
            <div className="w-16 h-16 rounded-2xl bg-black overflow-hidden">
              <img src="/games/trivia.png" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="font-black text-2xl leading-tight">Trivia</div>
            <div className="text-xs font-bold text-black/70">Play now ›</div>
          </Link>
          <div className="hidden md:block">
            <GameScanTile title="Bingo" path="/bingo" accent="sky" />
          </div>
          <Link
            href="/bingo"
            className="md:hidden rounded-3xl bg-sky-400 text-black p-4 flex flex-col items-center gap-2 shadow-lg shadow-sky-400/25 transition active:scale-95"
          >
            <div className="w-16 h-16 rounded-2xl bg-black overflow-hidden">
              <img src="/games/bingo.png" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="font-black text-2xl leading-tight">Bingo</div>
            <div className="text-xs font-bold text-black/70">Play now ›</div>
          </Link>
          {[
            { name: "Wild Match", icon: "cards" },
            { name: "Drop Line", icon: "discs" },
          ].map((g) => (
            <div key={g.name} className="rounded-3xl bg-white/[0.06] border border-white/15 p-4 flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-2xl bg-black/40 flex items-center justify-center text-pink-300">
                <Icon name={g.icon} size={34} />
              </div>
              <div className="font-black text-2xl leading-tight">{g.name}</div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Coming soon</div>
            </div>
          ))}
        </div>

        <MonthlyChampion />
        <Leaderboard />
      </div>
    </main>
  );
}
