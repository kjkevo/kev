"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { linkThisPhone } from "@/lib/progress";

const ERRORS: [RegExp, string][] = [
  [/rate limit|too many|security purposes/i, "Too many tries. Wait a minute and try again."],
  [/expired|invalid|token/i, "That code didn't work. Check it, or send a new one."],
  [/email.*invalid|valid email/i, "That email doesn't look right."],
];

function friendly(err: unknown) {
  const msg = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
  return ERRORS.find(([re]) => re.test(msg))?.[1] ?? "Something went wrong. Try again.";
}

/**
 * Save progress with an email: type the email, get a 6-digit code, type it in.
 * The same sheet signs in on a new phone ("I already saved"); progress from
 * this phone is merged into the account either way.
 */
export function AccountSheet({ onClose, signIn = false }: { onClose: () => void; signIn?: boolean }) {
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [merged, setMerged] = useState(false);

  async function sendCode() {
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError("That email doesn't look right.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: clean,
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/?saved=1` },
    });
    setBusy(false);
    if (err) setError(friendly(err));
    else {
      setEmail(clean);
      setStep("code");
    }
  }

  async function verify() {
    const token = code.replace(/\D/g, "");
    if (token.length < 6) {
      setError("Enter the code from the email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.verifyOtp({ email, token, type: "email" });
      if (err) throw err;
      const r = await linkThisPhone();
      setMerged(!!r?.o_merged);
      setStep("done");
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-white/10 p-6 text-white text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {step === "email" && (
          <>
            <p className="text-2xl font-black">{signIn ? "Sign in" : "Save your progress"}</p>
            <p className="mt-1 text-sm text-slate-300">
              {signIn
                ? "Enter the email you saved with. We'll send you a code."
                : "Keep your level, streak and characters on any phone. No password."}
            </p>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendCode()}
              placeholder="you@email.com"
              className="mt-4 w-full rounded-2xl bg-white/10 border border-white/15 px-4 py-3 text-lg text-center outline-none focus:border-amber-400"
            />
            <button
              type="button"
              onClick={sendCode}
              disabled={busy}
              className="mt-3 w-full rounded-2xl bg-amber-400 text-black font-black text-lg py-3 disabled:opacity-60 active:scale-95 transition"
            >
              {busy ? "Sending…" : "Send my code"}
            </button>
          </>
        )}

        {step === "code" && (
          <>
            <p className="text-2xl font-black">Check your email</p>
            <p className="mt-1 text-sm text-slate-300">
              We sent a code to <span className="font-bold text-white">{email}</span>
            </p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
              onKeyDown={(e) => e.key === "Enter" && verify()}
              placeholder="••••••"
              className="mt-4 w-full rounded-2xl bg-white/10 border border-white/15 px-4 py-3 text-3xl font-black tracking-[0.4em] text-center outline-none focus:border-amber-400"
            />
            <button
              type="button"
              onClick={verify}
              disabled={busy}
              className="mt-3 w-full rounded-2xl bg-amber-400 text-black font-black text-lg py-3 disabled:opacity-60 active:scale-95 transition"
            >
              {busy ? "Checking…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCode("");
                setError(null);
                setStep("email");
              }}
              className="mt-3 text-sm text-slate-400 underline"
            >
              Use a different email or send again
            </button>
          </>
        )}

        {step === "done" && (
          <>
            
            <p className="mt-2 text-2xl font-black">{merged ? "Welcome back!" : "Progress saved"}</p>
            <p className="mt-1 text-sm text-slate-300">
              {merged
                ? "Your level, streak and characters are on this phone now."
                : "Sign in with this email on any phone to pick up where you left off."}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-2xl bg-amber-400 text-black font-black text-lg py-3 active:scale-95 transition"
            >
              Done
            </button>
          </>
        )}

        {error && <p className="mt-3 text-sm font-bold text-rose-300">{error}</p>}
        {step !== "done" && (
          <button type="button" onClick={onClose} className="mt-4 block mx-auto text-sm text-slate-500">
            Not now
          </button>
        )}
      </div>
    </div>
  );
}
