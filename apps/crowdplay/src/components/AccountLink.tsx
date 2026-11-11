"use client";

import { useState } from "react";
import { AccountSheet } from "@/components/AccountSheet";
import { useProgress } from "@/lib/progress";

/**
 * A small sign-in line: "Already saved? Sign in" for guests, or which email
 * this phone's progress is saved to.
 */
export function AccountLink() {
  const { progress: p } = useProgress();
  const [open, setOpen] = useState(false);
  if (!p) return null;
  return (
    <div className="text-center text-base">
      {p.saved ? (
        <span className="text-slate-400">Signed in as {p.email}</span>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="text-slate-300">
          Have an account? <span className="font-bold text-amber-300 underline">Sign in</span>
        </button>
      )}
      {open && <AccountSheet signIn onClose={() => setOpen(false)} />}
    </div>
  );
}
