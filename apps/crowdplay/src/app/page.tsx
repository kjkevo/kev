import Image from "next/image";
import Link from "next/link";

const GAMES = [
  {
    name: "Trivia",
    initial: "T",
    tagline: "Live rounds, real time leaderboard",
    href: "/trivia",
    live: true,
  },
  {
    name: "Family Feud",
    initial: "F",
    tagline: "Top answers, buzzer battles",
    href: "/feud",
    live: true,
  },
  {
    name: "Social Bingo",
    initial: "B",
    tagline: "Meet people, mark your card",
    href: "/bingo",
    live: true,
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
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-10 bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white px-6 py-16 text-center">
      <div>
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight">
          Crowd<span className="text-amber-400">Play</span>
        </h1>
        <p className="mt-3 text-lg text-indigo-200">Live games for your bar. No app, no login, just a phone.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">
        {GAMES.map((game) =>
          game.live ? (
            <Link
              key={game.name}
              href={game.href}
              className="group rounded-2xl bg-white/5 border border-white/10 hover:border-amber-400/60 hover:bg-white/10 px-6 py-8 text-left transition active:scale-95"
            >
              <div className="w-10 h-10 mb-3 rounded-xl bg-amber-400 text-black font-black text-lg flex items-center justify-center">
                {game.initial}
              </div>
              <div className="font-bold text-xl">{game.name}</div>
              <div className="text-sm text-slate-400 mt-1">{game.tagline}</div>
              <div className="mt-4 inline-block text-xs font-semibold text-amber-400 group-hover:translate-x-1 transition">
                Play now
              </div>
            </Link>
          ) : (
            <div
              key={game.name}
              className="rounded-2xl bg-white/[0.03] border border-white/5 px-6 py-8 text-left opacity-50 cursor-not-allowed"
            >
              <div className="w-10 h-10 mb-3 rounded-xl bg-white/10 text-slate-400 font-black text-lg flex items-center justify-center">
                {game.initial}
              </div>
              <div className="font-bold text-xl">{game.name}</div>
              <div className="text-sm text-slate-500 mt-1">{game.tagline}</div>
              <div className="mt-4 inline-block text-xs font-semibold text-slate-500">Coming soon</div>
            </div>
          )
        )}
      </div>

      <div className="flex flex-col items-center -mt-2">
        <Image
          src="/avatars/alien-buddy.png"
          alt="CrowdPlay's alien mascot, waving you in"
          width={200}
          height={200}
          priority
          className="w-40 h-40 sm:w-48 sm:h-48 object-contain drop-shadow-[0_12px_32px_rgba(74,222,128,0.25)] animate-[float_4s_ease-in-out_infinite]"
        />
        <p className="text-xs text-indigo-300/70 -mt-1">Unlock him as your avatar in any game</p>
      </div>

      <p className="text-xs text-indigo-300/60 max-w-xs">
        Playing? Ask your host for the room code, or scan the QR code on their screen.
      </p>
    </main>
  );
}
