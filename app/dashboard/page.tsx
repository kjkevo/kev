import { supabase } from "@/app/lib/supabase";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { data: raw, error } = await supabase
    .from("Lead")
    .select("*")
    .order("createdAt", { ascending: false });

  if (error) console.error("DB error on dashboard:", error.message);

  const leads = (raw ?? []).map((l) => ({
    id: l.id as number,
    companyName: l.companyName as string,
    website: (l.website ?? null) as string | null,
    contactName: l.contactName as string,
    title: l.title as string,
    email: l.email as string,
    phone: (l.phone ?? null) as string | null,
    triggerEvent: l.triggerEvent as string,
    intelligenceSummary: l.intelligenceSummary as string,
    status: l.status as string,
    notes: (l.notes ?? null) as string | null,
    tags: (l.tags ?? []) as string[],
    createdAt: l.createdAt as string,
    aiScore: (l.aiScore ?? null) as number | null,
    aiScoreReason: (l.aiScoreReason ?? null) as string | null,
    aiSuggestion: (l.aiSuggestion ?? null) as string | null,
  }));

  return <DashboardClient leads={leads} user={{ name: null, email: null }} />;
}
