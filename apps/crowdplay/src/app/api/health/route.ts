import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * For an outside uptime monitor (checked every minute). 200 when every game
 * clock is running and no game is frozen; 503 with the problems otherwise,
 * or when the database doesn't answer within 8 seconds. See game_health()
 * (migration 0126).
 */
export async function GET() {
  const started = Date.now();
  try {
    const result = await Promise.race([
      supabase.rpc("game_health"),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
    ]);
    const ms = Date.now() - started;
    if (result.error || !result.data) {
      return NextResponse.json({ ok: false, problems: ["The database answered with an error"], ms }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    const health = result.data as { ok: boolean; problems: string[]; checked_at: string };
    return NextResponse.json({ ...health, ms }, { status: health.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { ok: false, problems: ["The database didn't answer within 8 seconds"], ms: Date.now() - started },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
