"use client";

import { useEffect, useState } from "react";

/** A big "Reconnecting…" bar while a game page can't reach the server (bad bar Wi-Fi). */
export function ConnectionBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const on = (e: Event) => {
      const r = (e as CustomEvent<{ reconnecting: boolean }>).detail?.reconnecting;
      clearTimeout(t);
      // A single slow answer isn't worth a banner; show it if it lasts.
      if (r) t = setTimeout(() => setShow(true), 1500);
      else setShow(false);
    };
    window.addEventListener("slimpse:connection", on);
    return () => {
      clearTimeout(t);
      window.removeEventListener("slimpse:connection", on);
    };
  }, []);
  if (!show) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[95] flex justify-center pointer-events-none">
      <div className="mt-2 rounded-full bg-amber-400 text-black px-5 py-2 text-xl font-black shadow-lg flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-black animate-ping" />
        Reconnecting…
      </div>
    </div>
  );
}
