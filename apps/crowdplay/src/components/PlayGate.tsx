"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { passStatus, touchPass } from "@/lib/checkin";
import { Icon } from "@/components/Icon";

const IDLE_MS = 20 * 60 * 1000;
const TOUCH_EVERY_MS = 60 * 1000;

/** The game pages (start pages and games). The main menu stays open. */
function isGamePage(path: string | null) {
  if (!path) return false;
  return ["/trivia", "/bingo", "/wild-match", "/drop-line", "/play/"].some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`));
}

/**
 * Play only at the bar: game pages need a check-in from scanning the bar's
 * TV. 20 minutes with no taps or answers ends it (time in a lobby or a game
 * in progress keeps it alive), and this screen asks them to scan again.
 */
export function PlayGate() {
  const path = usePathname();
  const gated = isGamePage(path);
  const [blocked, setBlocked] = useState<null | "scan" | "idle">(null);
  const lastActivity = useRef(Date.now());
  const lastTouch = useRef(0);

  useEffect(() => {
    if (!gated) {
      setBlocked(null);
      return;
    }
    let cancelled = false;
    passStatus().then((s) => {
      if (!cancelled) setBlocked(s.valid ? null : s.hadPass ? "idle" : "scan");
    });
    return () => {
      cancelled = true;
    };
  }, [gated, path]);

  useEffect(() => {
    if (!gated) return;
    const touch = () => {
      lastTouch.current = Date.now();
      touchPass().then((ok) => {
        if (!ok) setBlocked((b) => b ?? "idle");
      });
    };
    const onActivity = () => {
      lastActivity.current = Date.now();
      if (Date.now() - lastTouch.current > TOUCH_EVERY_MS) touch();
    };
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    const t = setInterval(() => {
      if (document.body.dataset.inGame === "1") {
        // In a lobby or a game: waiting counts as playing.
        lastActivity.current = Date.now();
        if (Date.now() - lastTouch.current > TOUCH_EVERY_MS) touch();
      } else if (Date.now() - lastActivity.current > IDLE_MS) {
        passStatus().then((s) => {
          if (!s.valid) setBlocked("idle");
        });
      }
    }, 15000);
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      clearInterval(t);
    };
  }, [gated]);

  if (!gated || !blocked) return null;
  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white px-6 text-center">
      <div className="w-28 h-28 rounded-3xl bg-white/10 flex items-center justify-center text-amber-300">
        <Icon name="qr" size={60} />
      </div>
      <h1 className="text-4xl font-black">{blocked === "idle" ? "Idle for too long" : "Scan to play"}</h1>
      <p className="text-2xl font-bold text-slate-200">
        {blocked === "idle" ? "Scan the code on the TV to play again." : "Scan the code on the TV at the bar."}
      </p>
      <Link href="/" className="mt-2 text-lg font-bold text-slate-300 underline">
        Back to games
      </Link>
    </div>
  );
}
