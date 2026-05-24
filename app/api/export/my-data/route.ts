import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import { logAudit } from "@/app/lib/audit";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const userEmail = session.user.email ?? "";
  const userName = session.user.name ?? userEmail;

  // Fetch user record (minus password)
  const { data: user } = await supabase
    .from("User")
    .select("id, name, email, createdAt")
    .eq("id", userId)
    .single();

  // Fetch leads where userId matches (no userId on Lead, so filter by assignedTo = user name/email)
  const { data: leads } = await supabase
    .from("Lead")
    .select("*")
    .or(`assignedTo.eq.${userName},assignedTo.eq.${userEmail}`);

  // Fetch activities
  const { data: activities } = await supabase
    .from("Activity")
    .select("*")
    .eq("userId", userId);

  // Fetch notifications
  const { data: notifications } = await supabase
    .from("Notification")
    .select("*")
    .eq("userId", userId);

  // Fetch team memberships
  const { data: teamMemberships } = await supabase
    .from("TeamMembership")
    .select("id, teamId, role, joinedAt")
    .eq("userId", userId);

  const exportData = {
    exportedAt: new Date().toISOString(),
    user: user ?? { id: userId, email: userEmail },
    leads: leads ?? [],
    activities: activities ?? [],
    notifications: notifications ?? [],
    teamMemberships: teamMemberships ?? [],
  };

  logAudit({
    userId,
    userEmail,
    action: "data.exported",
    entityType: "User",
    entityId: userId,
  });

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="leadiq-data-export-${Date.now()}.json"`,
    },
  });
}
