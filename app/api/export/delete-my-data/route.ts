import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const userName = session.user.name ?? session.user.email ?? "";

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (body.confirm !== "DELETE MY ACCOUNT") {
    return NextResponse.json(
      { error: 'You must confirm with "DELETE MY ACCOUNT"' },
      { status: 400 }
    );
  }

  // Delete notifications
  await supabase.from("Notification").delete().eq("userId", userId);

  // Delete activities by this user
  await supabase.from("Activity").delete().eq("userId", userId);

  // Delete team memberships
  await supabase.from("TeamMembership").delete().eq("userId", userId);

  // Delete leads assigned to this user
  await supabase.from("Lead").delete().eq("assignedTo", userName);

  // Delete audit logs for this user
  await supabase.from("AuditLog").delete().eq("userId", userId);

  // Delete the user record
  const { error: userDeleteError } = await supabase
    .from("User")
    .delete()
    .eq("id", userId);

  if (userDeleteError) {
    return NextResponse.json({ error: userDeleteError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Your account and all associated data has been deleted.",
  });
}
