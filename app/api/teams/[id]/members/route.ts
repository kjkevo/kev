import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import { logAudit } from "@/app/lib/audit";

async function getCallerRole(userId: number, teamId: number): Promise<string | null> {
  const { data } = await supabase
    .from("TeamMembership")
    .select("role")
    .eq("userId", userId)
    .eq("teamId", teamId)
    .single();
  return (data?.role as string) ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = parseInt(session.user.id, 10);
  const teamId = parseInt(params.id, 10);
  if (isNaN(teamId)) return NextResponse.json({ error: "Invalid team id" }, { status: 400 });

  // Verify the caller is a member
  const callerRole = await getCallerRole(userId, teamId);
  if (!callerRole) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("TeamMembership")
    .select("id, userId, role, joinedAt, User(id, name, email)")
    .eq("teamId", teamId)
    .order("joinedAt", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const members = (data ?? []).map((m: Record<string, unknown>) => {
    const user = m.User as Record<string, unknown>;
    return {
      membershipId: m.id,
      userId: m.userId,
      name: user?.name ?? null,
      email: user?.email ?? "",
      role: m.role,
      joinedAt: m.joinedAt,
    };
  });

  return NextResponse.json(members);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const callerId = parseInt(session.user.id, 10);
  const teamId = parseInt(params.id, 10);
  if (isNaN(teamId)) return NextResponse.json({ error: "Invalid team id" }, { status: 400 });

  const callerRole = await getCallerRole(callerId, teamId);
  if (!callerRole || callerRole !== "admin") {
    return NextResponse.json({ error: "Only admins can invite members" }, { status: 403 });
  }

  const body = await req.json();
  const email = (body.email ?? "").trim().toLowerCase();
  const role = (body.role ?? "rep") as string;

  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  if (!["admin", "manager", "rep"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Find user by email
  const { data: user, error: userError } = await supabase
    .from("User")
    .select("id, email, name")
    .eq("email", email)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: "No user found with that email" }, { status: 404 });
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from("TeamMembership")
    .select("id")
    .eq("userId", user.id)
    .eq("teamId", teamId)
    .single();

  if (existing) {
    return NextResponse.json({ error: "User is already a member of this team" }, { status: 409 });
  }

  const { error: insertError } = await supabase
    .from("TeamMembership")
    .insert({ userId: user.id, teamId, role });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  logAudit({
    userId: callerId,
    userEmail: session.user.email ?? undefined,
    action: "team.member_added",
    entityType: "Team",
    entityId: teamId,
    meta: { addedUserId: user.id, addedUserEmail: user.email, role },
  });

  return NextResponse.json({ ok: true });
}
