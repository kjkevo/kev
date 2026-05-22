import { db } from "@/app/lib/db";
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

  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      activities: { orderBy: { date: "desc" } },
      customFieldValues: { include: { customField: true } },
    },
  });

  if (!lead) notFound();

  const serialized = {
    ...lead,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    activities: lead.activities.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      date: a.date.toISOString(),
    })),
    customFieldValues: lead.customFieldValues.map((cfv) => ({
      id: cfv.id,
      leadId: cfv.leadId,
      customFieldId: cfv.customFieldId,
      value: cfv.value,
      fieldName: cfv.customField.name,
    })),
  };

  return <LeadDetailClient lead={serialized} />;
}
