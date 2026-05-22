import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const leadId = parseInt(params.id, 10);
  if (isNaN(leadId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const activities = await db.activity.findMany({
    where: { leadId },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(activities);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const leadId = parseInt(params.id, 10);
  if (isNaN(leadId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();

  const activity = await db.activity.create({
    data: {
      leadId,
      type: body.type,
      content: body.content,
      date: body.date ? new Date(body.date) : new Date(),
    },
  });

  return NextResponse.json(activity, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const activityId = parseInt(searchParams.get("activityId") ?? "", 10);
  if (isNaN(activityId)) return NextResponse.json({ error: "Invalid activityId" }, { status: 400 });

  await db.activity.delete({ where: { id: activityId } });
  return NextResponse.json({ success: true });
}
