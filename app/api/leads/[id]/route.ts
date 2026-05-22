import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { data: lead, error: leadErr } = await supabase
    .from("Lead")
    .select("*")
    .eq("id", id)
    .single();

  if (leadErr || !lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: activities } = await supabase
    .from("Activity")
    .select("*")
    .eq("leadId", id)
    .order("date", { ascending: false });

  const { data: cfvRaw } = await supabase
    .from("CustomFieldValue")
    .select("*, CustomField(*)")
    .eq("leadId", id);

  return NextResponse.json({
    ...lead,
    activities: activities ?? [],
    customFieldValues: cfvRaw ?? [],
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();

  // Fetch existing lead to compare status
  const { data: existing } = await supabase.from("Lead").select("status, wonAt, lostAt").eq("id", id).single();

  const updatePayload: Record<string, unknown> = {
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
    updatedAt: new Date().toISOString(),
    // New fields
    dealValue: body.dealValue ?? null,
    source: body.source ?? null,
    assignedTo: body.assignedTo ?? null,
  };

  // Set wonAt when transitioning to "won" (if not already set)
  if (body.status === "won" && !existing?.wonAt) {
    updatePayload.wonAt = body.wonAt ?? new Date().toISOString();
  } else if (body.wonAt !== undefined) {
    updatePayload.wonAt = body.wonAt;
  }

  // Set lostAt when transitioning to "lost" (if not already set)
  if (body.status === "lost" && !existing?.lostAt) {
    updatePayload.lostAt = body.lostAt ?? new Date().toISOString();
  } else if (body.lostAt !== undefined) {
    updatePayload.lostAt = body.lostAt;
  }

  // Allow explicit lossReason update
  if (body.lossReason !== undefined) {
    updatePayload.lossReason = body.lossReason;
  }

  const { data, error } = await supabase
    .from("Lead")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  // Delete related records first (cascade)
  await supabase.from("Activity").delete().eq("leadId", id);
  await supabase.from("CustomFieldValue").delete().eq("leadId", id);

  const { error } = await supabase.from("Lead").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
