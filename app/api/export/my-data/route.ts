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

  // Fetch user's team IDs
  const { data: memberships } = await supabase
    .from("TeamMembership")
    .select("teamId")
    .eq("userId", userId);
  const teamIds = (memberships ?? []).map((m: Record<string, unknown>) => m.teamId as number);

  // Collect leads: team-scoped + assigned to user. Fall back to all leads if none found
  const seen = new Set<number>();
  let leads: Record<string, unknown>[] = [];

  if (teamIds.length > 0) {
    const { data: teamLeads } = await supabase.from("Lead").select("*").in("teamId", teamIds);
    for (const l of teamLeads ?? []) { seen.add(l.id as number); leads.push(l); }
  }
  // Always include leads assigned to this user by name or email
  const { data: assignedLeads } = await supabase.from("Lead").select("*")
    .or(`assignedTo.eq.${userName},assignedTo.eq.${userEmail}`);
  for (const l of assignedLeads ?? []) {
    if (!seen.has(l.id as number)) { seen.add(l.id as number); leads.push(l); }
  }
  // If still nothing, export all (solo user with unscoped leads)
  if (leads.length === 0) {
    const { data: allLeads } = await supabase.from("Lead").select("*");
    leads = allLeads ?? [];
  }

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

  const filename = `leadiq-data-export-${Date.now()}.json`;
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
