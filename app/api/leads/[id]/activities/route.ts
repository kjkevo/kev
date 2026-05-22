import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const leadId = parseInt(params.id, 10);
  if (isNaN(leadId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { data, error } = await supabase
    .from("Activity")
    .select("*")
    .eq("leadId", leadId)
    .order("date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const leadId = parseInt(params.id, 10);
  if (isNaN(leadId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();

  const { data, error } = await supabase
    .from("Activity")
    .insert({
      leadId,
      type: body.type,
      content: body.content,
      date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params: _params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const activityId = parseInt(searchParams.get("activityId") ?? "", 10);
  if (isNaN(activityId)) return NextResponse.json({ error: "Invalid activityId" }, { status: 400 });

  const { error } = await supabase.from("Activity").delete().eq("id", activityId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
