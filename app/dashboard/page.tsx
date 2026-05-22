import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { db } from "@/app/lib/db";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let session = null;
  let leads: {
    id: number;
    companyName: string;
    website: string | null;
    contactName: string;
    title: string;
    email: string;
    phone: string | null;
    triggerEvent: string;
    intelligenceSummary: string;
    status: string;
    notes: string | null;
    tags: string[];
    createdAt: string;
  }[] = [];

  try {
    session = await getServerSession(authOptions);
  } catch {
    // auth failure is non-fatal
  }

  try {
    const raw = await db.lead.findMany({ orderBy: { createdAt: "desc" } });
    leads = raw.map((l) => ({
      id: l.id,
      companyName: l.companyName,
      website: l.website,
      contactName: l.contactName,
      title: l.title,
      email: l.email,
      phone: l.phone,
      triggerEvent: l.triggerEvent,
      intelligenceSummary: l.intelligenceSummary,
      status: l.status,
      notes: l.notes,
      tags: l.tags,
      createdAt: l.createdAt.toISOString(),
    }));
  } catch (err) {
    console.error("DB error on dashboard:", err);
    // return empty leads — dashboard still renders
  }

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
