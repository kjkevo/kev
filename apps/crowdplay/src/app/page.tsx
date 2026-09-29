import Link from "next/link";
import { MyCharacterButton } from "@/components/CharacterLocker";

const GAMES = [
  {
    name: "Trivia",
    initial: "T",
    tagline: "Live teams, live leaderboard",
    href: "/trivia",
    live: true,
  },
  {
    name: "Family Feud",
    initial: "F",
    tagline: "Top answers, buzzer battles",
    href: "/feud",
    live: false,
  },
  {
    name: "Social Bingo",
    initial: "B",
    tagline: "Meet people, mark your card",
    href: "/bingo",
    live: false,
  },
  {
    name: "Sports Predictions",
    initial: "S",
    tagline: "Call it before it happens",
    href: "#",
    live: false,
  },
];

export default function Home() {
  const [trivia, ...soon] = GAMES;
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
        {/* The live game: one big card. */}
        <Link
          href={trivia.href}
          className="rounded-3xl bg-amber-400 text-black p-5 flex items-center gap-4 text-left shadow-lg shadow-amber-400/25 transition active:scale-95"
        >
          <div className="w-14 h-14 shrink-0 rounded-2xl bg-black text-amber-400 font-black text-2xl flex items-center justify-center">
            {trivia.initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-2xl leading-tight">{trivia.name}</div>
            <div className="text-sm font-semibold text-black/70">{trivia.tagline}</div>
          </div>
          <span className="text-2xl font-black">›</span>
        </Link>

        {/* Coming soon: a small row underneath. */}
        <div className="grid grid-cols-3 gap-2">
          {soon.map((game) => (
            <div
              key={game.name}
              className="rounded-2xl bg-white/[0.03] border border-white/5 px-2 py-3 flex flex-col items-center gap-1 opacity-60"
            >
              <div className="w-8 h-8 rounded-lg bg-white/10 text-slate-400 font-black text-sm flex items-center justify-center">
                {game.initial}
              </div>
              <div className="font-bold text-xs leading-tight">{game.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Coming soon</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
