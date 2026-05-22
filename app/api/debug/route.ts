import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { db } = await import("@/app/lib/db");
    const count = await db.lead.count();
    return NextResponse.json({ ok: true, leadCount: count });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? String(err),
        stack: error?.stack?.slice(0, 800),
        dbUrl: process.env.DATABASE_URL?.slice(0, 40) + "...",
      },
      { status: 500 }
    );
  }
}
