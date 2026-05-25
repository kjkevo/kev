import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const email = session.user.email ?? "user";

  // Generate a new TOTP secret
  const secret = generateSecret();

  // Store it (pending confirmation)
  const { error } = await supabase
    .from("User")
    .update({ twoFactorSecret: secret })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Generate the OTP auth URL
  const otpAuthUrl = generateURI({ issuer: "LeadIQ", label: email, secret });

  // Generate QR code as data URL
  const qrCode = await QRCode.toDataURL(otpAuthUrl);

  return NextResponse.json({ qrCode, secret });
}
