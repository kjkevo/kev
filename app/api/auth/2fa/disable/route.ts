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

  // Fetch user's secret
  const { data: user, error: userError } = await supabase
    .from("User")
    .select("twoFactorSecret, twoFactorEnabled")
    .eq("id", userId)
    .single();

  if (userError || !user?.twoFactorSecret || !user.twoFactorEnabled) {
    return NextResponse.json({ error: "2FA is not enabled" }, { status: 400 });
  }

  // Verify the code before disabling
  const result = verifySync({ token: code, secret: user.twoFactorSecret });
  const isValid = typeof result === "object" ? result.valid : result;
  if (!isValid) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  // Disable 2FA
  const { error } = await supabase
    .from("User")
    .update({ twoFactorEnabled: false, twoFactorSecret: null, twoFactorVerified: false })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logAudit({
    userId,
    userEmail: session.user.email ?? undefined,
    action: "2fa.disabled",
    entityType: "User",
    entityId: userId,
  });

  return NextResponse.json({ ok: true });
}
