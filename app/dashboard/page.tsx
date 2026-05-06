import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { db } from "@/app/lib/db";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  const raw = await db.lead.findMany({ orderBy: { createdAt: "desc" } });

  const leads = raw.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <DashboardClient
      leads={leads}
      user={{
        name: session?.user?.name ?? null,
        email: session?.user?.email ?? null,
      }}
    />
  );
}
