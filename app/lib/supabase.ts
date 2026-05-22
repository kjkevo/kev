import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client (uses HTTPS — works from Vercel serverless)
export const supabase = createClient(
  process.env.SUPABASE_URL ?? "https://yijvvnerlsqkqipaebxj.supabase.co",
  process.env.SUPABASE_ANON_KEY ?? ""
);
