import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { supabase } from "@/app/lib/supabase";
import { verifySync } from "otplib";

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseInt(token.id as string, 10);
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
    return NextResponse.json({ error: "2FA not configured" }, { status: 400 });
  }

  // Verify the code
  const result = verifySync({ token: code, secret: user.twoFactorSecret });
  const isValid = typeof result === "object" ? result.valid : result;
  if (!isValid) {
    return NextResponse.json({ error: "Invalid code, try again" }, { status: 400 });
  }

  // Set tf_done cookie
  const response = NextResponse.json({ ok: true });
  response.cookies.set("tf_done", "1", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: 86400,
  });

  return response;
}
