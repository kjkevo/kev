/* eslint-disable @next/next/no-img-element -- small static game icons */
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { MenuScanCode } from "@/components/ScanCards";
import { VenueBanner } from "@/components/VenueBanner";

const GAMES = [
  { name: "Trivia", path: "/trivia", img: "/games/trivia.png", icon: null, color: "bg-amber-400 shadow-amber-400/25", chip: "text-amber-300", iconColor: "" },
  { name: "Bingo", path: "/bingo", img: "/games/bingo.png", icon: null, color: "bg-sky-400 shadow-sky-400/25", chip: "text-sky-300", iconColor: "" },
  { name: "Wild Match", path: "/wild-match", img: null, icon: "cards", color: "bg-pink-400 shadow-pink-400/25", chip: "text-pink-300", iconColor: "text-pink-300" },
  { name: "Drop Line", path: "/drop-line", img: null, icon: "discs", color: "bg-emerald-400 shadow-emerald-400/25", chip: "text-emerald-300", iconColor: "text-emerald-300" },
];

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white px-4 py-8 text-center">
      <div>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight">
          Slim<span className="text-amber-400">pse</span>
        </h1>
        <p className="mt-2 text-lg sm:text-2xl font-bold text-indigo-200">Pick a game. No app needed.</p>
      </div>

      {/* A bar's own logo, welcome line and prize (?venue=...). */}
      <VenueBanner />

      {/* On a computer or TV: one big code. Scanning it opens this menu on the phone. */}
      <div className="hidden md:flex flex-col items-center gap-5">
        <MenuScanCode />
        <div className="flex gap-3">
          {GAMES.map((g) => (
            <span key={g.name} className={`rounded-full bg-white/10 px-4 py-1.5 text-lg font-black ${g.chip}`}>
              {g.name}
            </span>
          ))}
        </div>
      </div>

      {/* On a phone: the four games, tap one. */}
      <div className="md:hidden w-full max-w-sm grid grid-cols-2 gap-3">
        {GAMES.map((g) => (
          <Link
            key={g.name}
            href={`${g.path}?src=menu`}
            className={`rounded-3xl ${g.color} text-black p-4 flex flex-col items-center gap-2 shadow-lg transition active:scale-95`}
          >
            <div className={`w-16 h-16 rounded-2xl bg-black overflow-hidden flex items-center justify-center ${g.iconColor}`}>
              {g.img ? <img src={g.img} alt="" className="w-full h-full object-cover" /> : <Icon name={g.icon ?? "cards"} size={34} />}
            </div>
            <div className="font-black text-2xl leading-tight">{g.name}</div>
            <div className="text-base font-black text-black/70">Play</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
