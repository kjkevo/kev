import { supabase } from "@/app/lib/supabase";
import KanbanClient from "./KanbanClient";

export const dynamic = "force-dynamic";

export default async function KanbanPage() {
  const { data: raw, error } = await supabase
    .from("Lead")
    .select("id, companyName, contactName, title, email, triggerEvent, status, tags, createdAt")
    .order("createdAt", { ascending: false });

  if (error) console.error("DB error on kanban:", error.message);

  const leads = (raw ?? []).map((l) => ({
    id: l.id as number,
    companyName: l.companyName as string,
    contactName: l.contactName as string,
    title: l.title as string,
    email: l.email as string,
    triggerEvent: l.triggerEvent as string,
    status: l.status as string,
    tags: (l.tags ?? []) as string[],
    createdAt: l.createdAt as string,
  }));

  return <KanbanClient leads={leads} />;
}
