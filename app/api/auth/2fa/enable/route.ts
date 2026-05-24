import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import { verifySync } from "otplib";
import { logAudit } from "@/app/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const { code } = await req.json();

  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  // Fetch user's pending secret
  const { data: user, error: userError } = await supabase
    .from("User")
    .select("twoFactorSecret")
    .eq("id", userId)
    .single();

  if (userError || !user?.twoFactorSecret) {
    return NextResponse.json({ error: "No pending 2FA setup found" }, { status: 400 });
  }

  // Verify the code
  const result = verifySync({ token: code, secret: user.twoFactorSecret });
  const isValid = typeof result === "object" ? result.valid : result;
  if (!isValid) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  // Enable 2FA
  const { error } = await supabase
    .from("User")
    .update({ twoFactorEnabled: true, twoFactorVerified: true })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logAudit({
    userId,
    userEmail: session.user.email ?? undefined,
    action: "2fa.enabled",
    entityType: "User",
    entityId: userId,
  });

  return NextResponse.json({ ok: true });
}
