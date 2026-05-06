import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";

  const leads = await db.lead.findMany({
    where: search
      ? {
          OR: [
            { contactName: { contains: search } },
            { email: { contains: search } },
            { companyName: { contains: search } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(leads);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const lead = await db.lead.create({
    data: {
      companyName: body.companyName,
      website: body.website,
      contactName: body.contactName,
      title: body.title,
      email: body.email,
      phone: body.phone,
      triggerEvent: body.triggerEvent,
      intelligenceSummary: body.intelligenceSummary,
    },
  });

  return NextResponse.json(lead, { status: 201 });
}
