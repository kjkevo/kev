import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import TeamClient from "./TeamClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");
  const userId = parseInt(session.user.id, 10);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold text-brand-700 shrink-0">
            LeadIQ
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500">
            <Link href="/dashboard" className="hover:text-gray-900 transition-colors">Dashboard</Link>
            <Link href="/kanban" className="hover:text-gray-900 transition-colors">Kanban</Link>
            <Link href="/leads" className="hover:text-gray-900 transition-colors">All Leads</Link>
            <Link href="/analytics" className="hover:text-gray-900 transition-colors">Analytics</Link>
            <Link href="/team" className="text-brand-600 font-semibold">Team</Link>
            <Link href="/team-feed" className="hover:text-gray-900 transition-colors">Feed</Link>
          </nav>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-gray-500 hover:text-gray-900"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <TeamClient currentUserId={userId} />
    </div>
  );
}
