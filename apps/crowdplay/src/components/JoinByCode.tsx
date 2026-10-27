"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Join a trivia game by typing its 5-character code (shown on the TV and in
 * every lobby), for anyone who can't or won't scan the QR code.
 */
export function JoinByCode({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (clean.length === 5) router.push(`/play/${clean}`);
      }}
      className={`flex items-center gap-2 ${className}`}
    >
      <input
        value={clean}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Game code"
        aria-label="Game code"
        autoCapitalize="characters"
        autoComplete="off"
        className="w-36 text-center text-lg font-black tracking-widest uppercase bg-white/10 border border-white/20 rounded-xl px-3 py-2 outline-none focus:border-amber-400 placeholder:text-sm placeholder:font-semibold placeholder:tracking-normal placeholder:normal-case"
      />
      <button
        disabled={clean.length !== 5}
        className="rounded-xl bg-amber-400 text-black font-black px-4 py-2 disabled:opacity-40 active:scale-95 transition"
      >
        Join
      </button>
    </form>
  );
}
