"use client";

import { useEffect, useState } from "react";
import { isMuted, setMuted, sounds, unlockSound } from "@/lib/sounds";

/** A small speaker button to turn game sounds on or off (remembered). */
export function SoundToggle({ className = "" }: { className?: string }) {
  const [muted, setM] = useState(false);
  useEffect(() => setM(isMuted()), []);
  return (
    <button
      type="button"
      onClick={async () => {
        const next = !muted;
        setMuted(next);
        setM(next);
        if (!next) {
          await unlockSound();
          sounds.tap();
        }
      }}
      aria-label={muted ? "Turn sound on" : "Turn sound off"}
      className={`w-10 h-10 rounded-full bg-white/10 border border-white/15 text-lg flex items-center justify-center active:scale-90 transition ${className}`}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
