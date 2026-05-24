import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import FeedClient from "./FeedClient";

export const dynamic = "force-dynamic";

export default async function TeamFeedPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");
  const userId = parseInt(session.user.id, 10);

  // Get team IDs for this user
  const { data: memberships } = await supabase
    .from("TeamMembership")
    .select("teamId")
    .eq("userId", userId);

  const teamIds = (memberships ?? []).map((m: Record<string, unknown>) => m.teamId as number);

  let initialActivities: {
    id: number;
    type: string;
    content: string;
    date: string;
    createdAt: string;
    userName: string | null;
    leadId: number;
    leadCompany: string;
    userId: number | null;
  }[] = [];

  if (teamIds.length > 0) {
    const { data: leads } = await supabase
      .from("Lead")
      .select("id, companyName")
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

      initialActivities = (acts ?? []).map((a: Record<string, unknown>) => ({
        id: a.id as number,
        type: a.type as string,
        content: a.content as string,
        date: a.date as string,
        createdAt: a.createdAt as string,
        userName: (a.userName ?? null) as string | null,
        userId: (a.userId ?? null) as number | null,
        leadId: a.leadId as number,
        leadCompany: leadMap[a.leadId as number] ?? "Unknown Lead",
      }));
    }
  } else {
    // No team: show all activities (solo mode fallback)
    const { data: acts } = await supabase
      .from("Activity")
      .select("id, type, content, date, createdAt, userId, userName, leadId, Lead(id, companyName)")
      .order("date", { ascending: false })
      .limit(100);

    initialActivities = (acts ?? []).map((a: Record<string, unknown>) => {
      const lead = a.Lead as Record<string, unknown> | null;
      return {
        id: a.id as number,
        type: a.type as string,
        content: a.content as string,
        date: a.date as string,
        createdAt: a.createdAt as string,
        userName: (a.userName ?? null) as string | null,
        userId: (a.userId ?? null) as number | null,
        leadId: a.leadId as number,
        leadCompany: (lead?.companyName ?? "Unknown Lead") as string,
      };
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold text-brand-700 shrink-0">
            LeadIQ
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500">
            <Link href="/dashboard" className="hover:text-gray-900 transition-colors">Dashboard</Link>
            <Link href="/kanban" className="hover:text-gray-900 transition-colors">Kanban</Link>
            <Link href="/leads" className="hover:text-gray-900 transition-colors">All Leads</Link>
            <Link href="/analytics" className="hover:text-gray-900 transition-colors">Analytics</Link>
            <Link href="/team" className="hover:text-gray-900 transition-colors">Team</Link>
            <Link href="/team-feed" className="text-brand-600 font-semibold">Feed</Link>
          </nav>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-gray-500 hover:text-gray-900"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <FeedClient initialActivities={initialActivities} />
    </div>
  );
}
