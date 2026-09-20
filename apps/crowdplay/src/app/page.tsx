import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-10 bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white px-6 text-center">
      <div>
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight">
          Crowd<span className="text-amber-400">Play</span>
        </h1>
        <p className="mt-3 text-lg text-indigo-200">
          Live trivia for your bar. No app, no login — just a phone.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
        <Link
          href="/host"
          className="flex-1 rounded-2xl bg-amber-400 text-black font-bold text-lg py-5 shadow-lg shadow-amber-400/20 active:scale-95 transition"
        >
          I&apos;m Hosting
        </Link>
        <Link
          href="/join"
          className="flex-1 rounded-2xl bg-white/10 border border-white/20 font-bold text-lg py-5 backdrop-blur active:scale-95 transition"
        >
          I&apos;m Playing
        </Link>
      </div>

      <p className="text-xs text-indigo-300/60 max-w-xs">
        Playing? Ask your host for the room code, or scan the QR code on their screen.
      </p>
    </main>
  );
}
