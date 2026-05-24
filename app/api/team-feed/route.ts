import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = parseInt(session.user.id, 10);

  // Get the team IDs this user belongs to
  const { data: memberships } = await supabase
    .from("TeamMembership")
    .select("teamId")
    .eq("userId", userId);

  const teamIds = (memberships ?? []).map((m: Record<string, unknown>) => m.teamId as number);

  // Build a set of lead IDs to show:
  // - If user has teams AND there are team-scoped leads, show those
  // - Otherwise show all leads (so the feed works from day 1 before leads are team-scoped)
  let scopedLeadIds: number[] | null = null;

  if (teamIds.length > 0) {
    const { data: teamLeads } = await supabase
      .from("Lead")
      .select("id")
      .in("teamId", teamIds);

    if (teamLeads && teamLeads.length > 0) {
      scopedLeadIds = teamLeads.map((l: Record<string, unknown>) => l.id as number);
    }
    // If no leads are team-scoped yet, scopedLeadIds stays null → show all
  }

  // Fetch all leads for the company name map
  const { data: allLeads } = await supabase.from("Lead").select("id, companyName");
  const leadMap = Object.fromEntries(
    (allLeads ?? []).map((l: Record<string, unknown>) => [l.id as number, l.companyName as string])
  );

  // Fetch activities
  let query = supabase
    .from("Activity")
    .select("id, type, content, date, createdAt, userId, userName, leadId")
    .order("date", { ascending: false })
    .limit(100);

  if (scopedLeadIds !== null) {
    query = query.in("leadId", scopedLeadIds);
  }

  const { data: acts } = await query;

  const activities = (acts ?? []).map((a: Record<string, unknown>) => ({
    id: a.id,
    type: a.type,
    content: a.content,
    date: a.date,
    createdAt: a.createdAt,
    userId: a.userId,
    userName: a.userName,
    leadId: a.leadId,
    leadCompany: leadMap[a.leadId as number] ?? "Unknown Lead",
  }));

  return NextResponse.json(activities);
}
