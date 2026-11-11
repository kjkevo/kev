import Link from "next/link";
import { Icon } from "@/components/Icon";

/** Drop Line is on the way; its scan code already lands here. */
export default function ComingSoon() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white px-6 text-center">
      <div className="w-24 h-24 rounded-3xl bg-black/40 flex items-center justify-center text-pink-300">
        <Icon name="discs" size={52} />
      </div>
      <h1 className="text-5xl font-black">Drop Line</h1>
      <p className="text-2xl font-bold text-slate-200">Coming soon!</p>
      <Link href="/" className="mt-2 rounded-2xl bg-amber-400 text-black font-black text-xl px-8 py-4">
        Play another game
      </Link>
    </main>
  );
}
