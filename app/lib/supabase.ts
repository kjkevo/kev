import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client (uses HTTPS — works from Vercel serverless)
// Force Next.js fetch cache to bypass so queries always return fresh data
export const supabase = createClient(
  process.env.SUPABASE_URL ?? "https://yijvvnerlsqkqipaebxj.supabase.co",
  process.env.SUPABASE_ANON_KEY ?? "",
  {
    global: {
      fetch: (url: RequestInfo | URL, options?: RequestInit) =>
        fetch(url, { ...options, cache: "no-store" }),
    },
  }
);
