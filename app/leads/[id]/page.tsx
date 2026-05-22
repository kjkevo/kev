import { supabase } from "@/app/lib/supabase";
import { notFound } from "next/navigation";
import LeadDetailClient from "./LeadDetailClient";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) notFound();

  const { data: lead, error } = await supabase
    .from("Lead")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !lead) notFound();

  const { data: activities } = await supabase
    .from("Activity")
    .select("*")
    .eq("leadId", id)
    .order("date", { ascending: false });

  const { data: cfvRaw } = await supabase
    .from("CustomFieldValue")
    .select("*, CustomField(*)")
    .eq("leadId", id);

  const serialized = {
    ...lead,
    createdAt: lead.createdAt as string,
    updatedAt: lead.updatedAt as string,
    activities: (activities ?? []).map((a) => ({
      id: a.id as number,
      leadId: a.leadId as number,
      type: a.type as string,
      content: a.content as string,
      createdAt: a.createdAt as string,
      date: a.date as string,
    })),
    customFieldValues: (cfvRaw ?? []).map((cfv) => ({
      id: cfv.id as number,
      leadId: cfv.leadId as number,
      customFieldId: cfv.customFieldId as number,
      value: cfv.value as string,
      fieldName: ((cfv.CustomField ?? {}) as Record<string, string>).name ?? "",
    })),
  };

  return <LeadDetailClient lead={serialized} />;
}
