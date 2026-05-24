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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const callerId = parseInt(session.user.id, 10);
  const teamId = parseInt(params.id, 10);
  const targetUserId = parseInt(params.userId, 10);

  if (isNaN(teamId) || isNaN(targetUserId)) {
    return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
  }

  const callerRole = await getCallerRole(callerId, teamId);
  if (callerRole !== "admin") {
    return NextResponse.json({ error: "Only admins can change roles" }, { status: 403 });
  }

  const body = await req.json();
  const role = body.role as string;
  if (!["admin", "manager", "rep"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const { error } = await supabase
    .from("TeamMembership")
    .update({ role })
    .eq("userId", targetUserId)
    .eq("teamId", teamId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const callerId = parseInt(session.user.id, 10);
  const teamId = parseInt(params.id, 10);
  const targetUserId = parseInt(params.userId, 10);

  if (isNaN(teamId) || isNaN(targetUserId)) {
    return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
  }

  // Allow self-removal; otherwise must be admin
  if (callerId !== targetUserId) {
    const callerRole = await getCallerRole(callerId, teamId);
    if (callerRole !== "admin") {
      return NextResponse.json({ error: "Only admins can remove other members" }, { status: 403 });
    }
  }

  const { error } = await supabase
    .from("TeamMembership")
    .delete()
    .eq("userId", targetUserId)
    .eq("teamId", teamId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAudit({
    userId: callerId,
    userEmail: session.user.email ?? undefined,
    action: "team.member_removed",
    entityType: "Team",
    entityId: teamId,
    meta: { removedUserId: targetUserId },
  });

  return NextResponse.json({ ok: true });
}
