import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = parseInt(params.id, 10);
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.label !== undefined) updates.label = body.label;
  if (body.color !== undefined) updates.color = body.color;
  if (body.position !== undefined) updates.position = body.position;

  const { data, error } = await supabase
    .from("PipelineStage")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = parseInt(params.id, 10);

  // Get the stage key first
  const { data: stage } = await supabase
    .from("PipelineStage")
    .select("key")
    .eq("id", id)
    .single();

  if (stage) {
    // Check if any leads use this stage
    const { count } = await supabase
      .from("Lead")
      .select("id", { count: "exact", head: true })
      .eq("status", stage.key);

    if (count && count > 0) {
      return NextResponse.json(
        { error: `${count} lead${count !== 1 ? "s" : ""} are using this stage` },
        { status: 409 }
      );
    }
  }

  const { error } = await supabase.from("PipelineStage").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
