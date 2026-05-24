import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { redirect } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import AuditLogClient from "./AuditLogClient";
import Link from "next/link";

export default async function AuditLogPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const userId = parseInt(session.user.id, 10);

  // Check admin status
  const { data: adminMembership } = await supabase
    .from("TeamMembership")
    .select("id")
    .eq("userId", userId)
    .eq("role", "admin")
    .limit(1)
    .single();

  const isAdmin = !!adminMembership;

  // Fetch first page
  let query = supabase
    .from("AuditLog")
    .select("*", { count: "exact" })
    .order("createdAt", { ascending: false })
    .range(0, 49);

  if (!isAdmin) {
    query = query.eq("userId", userId);
  }

  const { data: logs, count } = await query;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Audit Log</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {isAdmin ? "Full activity log for your organization" : "Your activity history"}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
          >
            &larr; Dashboard
          </Link>
        </div>

        <AuditLogClient
          initialLogs={(logs ?? []) as Parameters<typeof AuditLogClient>[0]["initialLogs"]}
          initialTotal={count ?? 0}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
