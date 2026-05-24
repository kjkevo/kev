import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = parseInt(session.user.id, 10);

  // Get all team memberships for this user, joining Team
  const { data: memberships, error } = await supabase
    .from("TeamMembership")
    .select("id, role, joinedAt, teamId, Team(id, name)")
    .eq("userId", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // For each team, get member count
  const teamIds = (memberships ?? []).map((m: Record<string, unknown>) => m.teamId as number);

  let memberCounts: Record<number, number> = {};
  if (teamIds.length > 0) {
    const { data: countData } = await supabase
      .from("TeamMembership")
      .select("teamId")
      .in("teamId", teamIds);

    for (const row of countData ?? []) {
      memberCounts[row.teamId as number] = (memberCounts[row.teamId as number] ?? 0) + 1;
    }
  }

  const result = (memberships ?? []).map((m: Record<string, unknown>) => {
    const team = m.Team as Record<string, unknown>;
    const teamId = m.teamId as number;
    return {
      id: teamId,
      name: team?.name ?? "",
      role: m.role,
      memberCount: memberCounts[teamId] ?? 1,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = parseInt(session.user.id, 10);

  const body = await req.json();
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Team name is required" }, { status: 400 });

  // Create the team
  const { data: team, error: teamError } = await supabase
    .from("Team")
    .insert({ name })
    .select()
    .single();

  if (teamError) return NextResponse.json({ error: teamError.message }, { status: 500 });

  // Add creator as admin
  const { error: memberError } = await supabase
    .from("TeamMembership")
    .insert({ userId, teamId: team.id, role: "admin" });

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });

  return NextResponse.json({ id: team.id, name: team.name, role: "admin", memberCount: 1 }, { status: 201 });
}
