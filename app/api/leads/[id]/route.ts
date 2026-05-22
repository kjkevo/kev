import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      activities: { orderBy: { date: "desc" } },
      customFieldValues: { include: { customField: true } },
    },
  });

  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();

  const lead = await db.lead.update({
    where: { id },
    data: {
      companyName: body.companyName,
      website: body.website ?? null,
      contactName: body.contactName,
      title: body.title,
      email: body.email,
      phone: body.phone ?? null,
      triggerEvent: body.triggerEvent,
      intelligenceSummary: body.intelligenceSummary,
      status: body.status,
      notes: body.notes ?? null,
      tags: body.tags ?? [],
    },
  });

  return NextResponse.json(lead);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await db.lead.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
