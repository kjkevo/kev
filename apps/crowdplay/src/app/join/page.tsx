"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length < 4) return;
    router.push(`/play/${code.trim().toUpperCase()}`);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white flex flex-col items-center justify-center px-6 gap-6">
      <h1 className="text-3xl font-bold">Enter the room code</h1>
      <form onSubmit={go} className="flex flex-col gap-4 w-full max-w-xs">
        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="ABCDE"
          className="text-center text-4xl tracking-[0.3em] font-black bg-white/10 border border-white/20 rounded-2xl py-4 uppercase placeholder:text-white/20 outline-none focus:border-amber-400"
        />
        <button
          type="submit"
          className="rounded-2xl bg-amber-400 text-black font-bold text-lg py-4 active:scale-95 transition"
        >
          Join
        </button>
      </form>
    </main>
  );
}
