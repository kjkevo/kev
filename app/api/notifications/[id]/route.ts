import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = parseInt(session.user.id, 10);
  const notifId = parseInt(params.id, 10);
  if (isNaN(notifId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { error } = await supabase
    .from("Notification")
    .update({ read: true })
    .eq("id", notifId)
    .eq("userId", userId); // safety: only allow marking own notifications

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
