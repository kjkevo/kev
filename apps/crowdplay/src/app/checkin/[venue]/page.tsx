"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { rememberPlayerVenue, safeNextPath, stableKey } from "@/lib/venue";

type Queued = { venue: string; name: string; contact: string; at: number };

const QUEUE_KEY = "crowdplay_checkin_queue";
const MAX_QUEUE_AGE_MS = 6 * 60 * 60 * 1000;

const FIELD_ERRORS: Record<string, string> = {
  INVALID_NAME: "Enter your first name.",
  INVALID_CONTACT: "Enter a phone number or email we can recognize you by next time.",
  VENUE_NOT_FOUND: "This check-in link isn't set up for a venue yet. Ask the staff for the right code.",
};

function readQueue(): Queued[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as Queued[];
  } catch {
    return [];
  }
}
function writeQueue(items: Queued[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // storage blocked: nothing more we can do on this phone
  }
}

/**
 * A guest's check-in for one venue. If saving fails (bad signal, database
 * down), the guest still gets through -- they came to play, not to watch a
 * spinner -- but the failure is reported to the error log (so the owner's
 * dashboard shows it) and the check-in is kept on the phone and retried the
 * next time this page opens.
 */
export default function CheckinPage() {
  const params = useParams<{ venue: string }>();
  const venue = (params.venue ?? "").toLowerCase();
  const [next, setNext] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [done, setDone] = useState<{ returning: boolean; name: string } | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    setNext(safeNextPath(qs.get("next")));
    // One scan per browser session, so reloads don't inflate the count.
    supabase.rpc("log_qr_scan", { p_venue: venue, p_session_key: stableKey("crowdplay_scan_session", "session") });

    // Retry check-ins that failed to save earlier on this phone.
    const pending = readQueue().filter((q) => Date.now() - q.at < MAX_QUEUE_AGE_MS);
    writeQueue(pending);
    pending.forEach(async (q) => {
      const { error } = await supabase.rpc("checkin_submit", { p_venue: q.venue, p_name: q.name, p_contact: q.contact });
      if (!error) writeQueue(readQueue().filter((x) => x.at !== q.at));
    });
  }, [venue]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFieldError(null);
    setSaving(true);
    const { data, error } = await supabase.rpc("checkin_submit", {
      p_venue: venue,
      p_name: name.trim(),
      p_contact: contact.trim(),
    });
    setSaving(false);

    if (!error && data?.[0]) {
      rememberPlayerVenue(venue);
      setDone({ returning: data[0].o_returning, name: name.trim() });
      return;
    }
    const code = Object.keys(FIELD_ERRORS).find((k) => error?.message.includes(k));
    if (code) {
      setFieldError(FIELD_ERRORS[code]);
      return;
    }
    // Anything else is our fault, not the guest's: let them in, and make sure
    // the owner finds out.
    writeQueue([...readQueue(), { venue, name: name.trim(), contact: contact.trim(), at: Date.now() }]);
    supabase.rpc("log_client_error", {
      p_venue: venue,
      p_source: "checkin",
      p_message: `Check-in save failed: ${error?.message ?? "no response"}`.slice(0, 300),
    });
    rememberPlayerVenue(venue);
    setDone({ returning: false, name: name.trim() });
  }

  if (done) {
    return (
      <Shell>
        <h1 className="text-3xl font-black mb-2">
          {done.returning ? `Welcome back, ${done.name}!` : `You're in, ${done.name}!`}
        </h1>
        <p className="text-slate-300 mb-8">{done.returning ? "Good to see you again." : "Thanks for checking in."}</p>
        {next ? (
          <Link href={next} className="w-full max-w-xs rounded-2xl bg-amber-400 text-black font-bold text-lg py-4 text-center active:scale-95 transition">
            Join the game
          </Link>
        ) : (
          <div className="w-full max-w-xs flex flex-col gap-3">
            <GameLink href={`/trivia?venue=${venue}`} label="Trivia" />
            <GameLink href={`/feud?venue=${venue}`} label="Family Feud" />
            <GameLink href={`/bingo?venue=${venue}`} label="Social Bingo" />
          </div>
        )}
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-3xl font-black mb-1">Check in to play</h1>
      <p className="text-slate-400 mb-6">Takes 10 seconds. We&apos;ll recognize you next time.</p>
      <form onSubmit={submit} className="w-full max-w-xs flex flex-col gap-3">
        <label className="text-left text-sm text-slate-300" htmlFor="checkin-name">
          First name
        </label>
        <input
          id="checkin-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          autoComplete="given-name"
          required
          className="bg-white/10 border border-white/20 rounded-2xl py-3 px-4 text-lg outline-none focus:border-amber-400"
        />
        <label className="text-left text-sm text-slate-300 mt-1" htmlFor="checkin-contact">
          Phone or email
        </label>
        <input
          id="checkin-contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          maxLength={120}
          autoComplete="tel"
          inputMode="email"
          required
          className="bg-white/10 border border-white/20 rounded-2xl py-3 px-4 text-lg outline-none focus:border-amber-400"
        />
        {fieldError && <p className="text-rose-400 text-sm">{fieldError}</p>}
        <button
          disabled={saving || !name.trim() || !contact.trim()}
          className="mt-2 rounded-2xl bg-amber-400 text-black font-bold text-lg py-4 disabled:opacity-40 active:scale-95 transition"
        >
          {saving ? "Checking in…" : "Check in"}
        </button>
        <p className="text-xs text-slate-500">Used to count visits and recognize you when you come back.</p>
      </form>
    </Shell>
  );
}

function GameLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded-2xl bg-white/10 border border-white/15 font-bold text-lg py-4 text-center active:scale-95 transition">
      {label}
    </Link>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white flex flex-col items-center justify-center px-6 text-center">
      {children}
    </main>
  );
}
