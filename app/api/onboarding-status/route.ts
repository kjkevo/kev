import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  const [leadsRes, activitiesRes, scoredRes, stagesRes] = await Promise.all([
    supabase.from("Lead").select("id", { count: "exact", head: true }),
    supabase.from("Activity").select("id", { count: "exact", head: true }),
    supabase.from("Lead").select("id", { count: "exact", head: true }).not("aiScore", "is", null),
    supabase.from("PipelineStage").select("id", { count: "exact", head: true }).eq("userId", userId),
  ]);

  // Check if any teammate is in user's teams
  const { data: myTeams } = await supabase
    .from("TeamMembership")
    .select("teamId")
    .eq("userId", userId);

  let hasTeamMate = false;
  if (myTeams && myTeams.length > 0) {
    const teamIds = myTeams.map((t: { teamId: number }) => t.teamId);
    const { count } = await supabase
      .from("TeamMembership")
      .select("id", { count: "exact", head: true })
      .in("teamId", teamIds)
      .neq("userId", userId);
    hasTeamMate = (count ?? 0) > 0;
  }

  return NextResponse.json({
    hasLeads: (leadsRes.count ?? 0) > 0,
    hasActivities: (activitiesRes.count ?? 0) > 0,
    hasScoredLead: (scoredRes.count ?? 0) > 0,
    hasTeamMate,
    hasCustomStages: (stagesRes.count ?? 0) > 0,
  });
}
