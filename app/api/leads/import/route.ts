import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import Papa from "papaparse";

export async function POST(req: NextRequest) {
  const body = await req.text();

  const result = Papa.parse<Record<string, string>>(body, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, ""),
  });

  if (result.errors.length > 0) {
    return NextResponse.json({ error: "CSV parse error", details: result.errors }, { status: 400 });
  }

  const rows = result.data;

  // Flexible column name mapping
  function col(row: Record<string, string>, ...keys: string[]): string {
    for (const k of keys) {
      const v = row[k.toLowerCase().replace(/\s+/g, "")] ?? "";
      if (v) return v.trim();
    }
    return "";
  }

  const created: number[] = [];
  const skipped: string[] = [];

  for (const row of rows) {
    const email = col(row, "email");
    const companyName = col(row, "companyName", "company", "companyname");
    const contactName = col(row, "contactName", "contact", "name", "contactname");
    const title = col(row, "title", "jobtitle", "job_title");
    const triggerEvent = col(row, "triggerEvent", "trigger", "triggerevent");
    const intelligenceSummary = col(row, "intelligenceSummary", "summary", "intel", "intelligencesummary");

    if (!email || !companyName || !contactName) {
      skipped.push(email || "(no email)");
      continue;
    }

    try {
      const lead = await db.lead.upsert({
        where: { email },
        create: {
          companyName,
          website: col(row, "website") || null,
          contactName,
          title: title || "Unknown",
          email,
          phone: col(row, "phone") || null,
          triggerEvent: triggerEvent || "Imported",
          intelligenceSummary: intelligenceSummary || "Imported via CSV",
          status: col(row, "status") || "new",
          notes: col(row, "notes") || null,
          tags: col(row, "tags") ? col(row, "tags").split(";").map((t) => t.trim()).filter(Boolean) : [],
        },
        update: {
          companyName,
          website: col(row, "website") || null,
          contactName,
          title: title || "Unknown",
          phone: col(row, "phone") || null,
          triggerEvent: triggerEvent || "Imported",
          intelligenceSummary: intelligenceSummary || "Imported via CSV",
          status: col(row, "status") || "new",
          notes: col(row, "notes") || null,
          tags: col(row, "tags") ? col(row, "tags").split(";").map((t) => t.trim()).filter(Boolean) : [],
        },
      });
      created.push(lead.id);
    } catch {
      skipped.push(email);
    }
  }

  return NextResponse.json({ imported: created.length, skipped: skipped.length, skippedEmails: skipped }, { status: 201 });
}
