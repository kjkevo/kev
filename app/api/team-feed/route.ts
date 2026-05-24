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

  let activities: Record<string, unknown>[] = [];

  if (teamIds.length > 0) {
    // Get leads that belong to those teams
    const { data: leads } = await supabase
      .from("Lead")
      .select("id, companyName, teamId")
      .in("teamId", teamIds);

    const leadIds = (leads ?? []).map((l: Record<string, unknown>) => l.id as number);
    const leadMap = Object.fromEntries(
      (leads ?? []).map((l: Record<string, unknown>) => [l.id as number, l.companyName as string])
    );

    if (leadIds.length > 0) {
      const { data: acts } = await supabase
        .from("Activity")
        .select("id, type, content, date, createdAt, userId, userName, leadId")
        .in("leadId", leadIds)
        .order("date", { ascending: false })
        .limit(100);

      activities = (acts ?? []).map((a: Record<string, unknown>) => ({
        ...a,
        leadCompanyName: leadMap[a.leadId as number] ?? "Unknown Lead",
      }));
    }
  } else {
    // No team — show all activities for the user (solo mode)
    const { data: acts } = await supabase
      .from("Activity")
      .select("id, type, content, date, createdAt, userId, userName, leadId, Lead(id, companyName)")
      .order("date", { ascending: false })
      .limit(100);

    activities = (acts ?? []).map((a: Record<string, unknown>) => {
      const lead = a.Lead as Record<string, unknown> | null;
      return {
        id: a.id,
        type: a.type,
        content: a.content,
        date: a.date,
        createdAt: a.createdAt,
        userId: a.userId,
        userName: a.userName,
        leadId: a.leadId,
        leadCompanyName: lead?.companyName ?? "Unknown Lead",
      };
    });
  }

  return NextResponse.json(activities);
}
