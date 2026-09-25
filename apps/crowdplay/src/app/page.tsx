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
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white px-6 py-8 text-center">
      <div>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight">
          Crowd<span className="text-amber-400">Play</span>
        </h1>
        <p className="mt-2 text-sm sm:text-lg text-indigo-200">Live games for your bar. No app, no login, just a phone.</p>
      </div>

      {/* Small squares, two across even on phones, so the characters below
          are visible without scrolling. */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-[18rem] sm:max-w-md">
        {GAMES.map((game) =>
          game.live ? (
            <Link
              key={game.name}
              href={game.href}
              className="group aspect-square rounded-2xl bg-white/5 border border-white/10 hover:border-amber-400/60 hover:bg-white/10 p-3 flex flex-col items-center justify-center text-center transition active:scale-95"
            >
              <div className="w-9 h-9 mb-2 rounded-xl bg-amber-400 text-black font-black text-base flex items-center justify-center">
                {game.initial}
              </div>
              <div className="font-bold text-sm sm:text-lg leading-tight">{game.name}</div>
              <div className="text-[11px] sm:text-xs text-slate-400 mt-1 leading-snug">{game.tagline}</div>
            </Link>
          ) : (
            <div
              key={game.name}
              className="aspect-square rounded-2xl bg-white/[0.03] border border-white/5 p-3 flex flex-col items-center justify-center text-center opacity-50 cursor-not-allowed"
            >
              <div className="w-9 h-9 mb-2 rounded-xl bg-white/10 text-slate-400 font-black text-base flex items-center justify-center">
                {game.initial}
              </div>
              <div className="font-bold text-sm sm:text-lg leading-tight">{game.name}</div>
              <div className="text-[11px] sm:text-xs text-slate-500 mt-1">Coming soon</div>
            </div>
          )
        )}
      </div>

      <div className="flex flex-col items-center">
        <Image
          src="/avatars/alien-buddy.png"
          alt="CrowdPlay's alien mascot, waving you in"
          width={200}
          height={200}
          priority
          className="w-32 h-32 sm:w-44 sm:h-44 object-contain drop-shadow-[0_12px_32px_rgba(74,222,128,0.25)] animate-[float_4s_ease-in-out_infinite]"
        />
        <p className="text-xs text-indigo-300/70 -mt-1">Unlock him as your avatar in any game</p>
      </div>

      <p className="text-xs text-indigo-300/60 max-w-xs">
        Playing? Ask your host for the room code, or scan the QR code on their screen.
      </p>
    </main>
  );
}
