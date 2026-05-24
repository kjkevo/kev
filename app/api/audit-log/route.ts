import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
  const filterAction = searchParams.get("action") ?? "";
  const filterUserId = searchParams.get("userId") ?? "";
  const filterEmail = searchParams.get("email") ?? "";
  const offset = (page - 1) * limit;

  // Check if caller is an admin of any team
  const { data: adminMembership } = await supabase
    .from("TeamMembership")
    .select("id")
    .eq("userId", userId)
    .eq("role", "admin")
    .limit(1)
    .single();

  const isAdmin = !!adminMembership;

  let query = supabase
    .from("AuditLog")
    .select("*", { count: "exact" })
    .order("createdAt", { ascending: false })
    .range(offset, offset + limit - 1);

  // Non-admins only see their own logs
  if (!isAdmin) {
    query = query.eq("userId", userId);
  } else {
    // Admin filters
    if (filterUserId) query = query.eq("userId", parseInt(filterUserId, 10));
    if (filterEmail) query = query.ilike("userEmail", `%${filterEmail}%`);
  }

  if (filterAction) query = query.eq("action", filterAction);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    logs: data ?? [],
    total: count ?? 0,
    page,
    limit,
    isAdmin,
  });
}
