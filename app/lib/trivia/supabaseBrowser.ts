"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser (anon) Supabase client for the trivia game. Read-only by RLS — it can
// select the game/leaderboard tables and subscribe to their realtime changes,
// but every write goes through the /api/trivia/* routes (service role).
//
// Kept as a lazy singleton so we don't open multiple realtime connections.

let client: SupabaseClient | null = null;

export function getTriviaBrowserClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "See docs/TRIVIA_SETUP.md.",
    );
  }

  client = createClient(url, anonKey, {
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return client;
}
