import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { count, error } = await supabase
      .from("Lead")
      .select("*", { count: "exact", head: true });

    if (error) throw error;

    return NextResponse.json({ ok: true, leadCount: count ?? 0 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { ok: false, error: error?.message ?? String(err) },
      { status: 500 }
    );
  }
}
