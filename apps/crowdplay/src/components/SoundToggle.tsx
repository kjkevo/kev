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
      <SpeakerIcon muted={muted} />
    </button>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
      {muted ? <path d="m22 9-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
    </svg>
  );
}
