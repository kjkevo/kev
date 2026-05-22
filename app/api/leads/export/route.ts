import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import Papa from "papaparse";

export const dynamic = "force-dynamic";

export async function GET() {
  const leads = await db.lead.findMany({ orderBy: { createdAt: "desc" } });

  const rows = leads.map((l) => ({
    id: l.id,
    companyName: l.companyName,
    website: l.website ?? "",
    contactName: l.contactName,
    title: l.title,
    email: l.email,
    phone: l.phone ?? "",
    triggerEvent: l.triggerEvent,
    intelligenceSummary: l.intelligenceSummary,
    status: l.status,
    notes: l.notes ?? "",
    tags: l.tags.join(";"),
    createdAt: l.createdAt.toISOString(),
  }));

  const csv = Papa.unparse(rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
