import { db } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import KanbanClient from "./KanbanClient";

export const dynamic = "force-dynamic";

export default async function KanbanPage() {
  await getServerSession(authOptions);

  const raw = await db.lead.findMany({ orderBy: { createdAt: "desc" } });

  const leads = raw.map((l) => ({
    id: l.id,
    companyName: l.companyName,
    contactName: l.contactName,
    title: l.title,
    email: l.email,
    triggerEvent: l.triggerEvent,
    status: l.status,
    tags: l.tags,
    createdAt: l.createdAt.toISOString(),
  }));

  return <KanbanClient leads={leads} />;
}
