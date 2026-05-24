import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";

const DEFAULT_STAGES = [
  { key: "new", label: "New", color: "gray", position: 0, isDefault: true },
  { key: "contacted", label: "Contacted", color: "blue", position: 1, isDefault: true },
  { key: "qualified", label: "Qualified", color: "cyan", position: 2, isDefault: true },
  { key: "proposal", label: "Proposal", color: "amber", position: 3, isDefault: true },
  { key: "negotiation", label: "Negotiation", color: "orange", position: 4, isDefault: true },
  { key: "won", label: "Won", color: "emerald", position: 5, isDefault: true },
  { key: "lost", label: "Lost", color: "rose", position: 6, isDefault: true },
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(DEFAULT_STAGES);
  }
  const userId = parseInt(session.user.id, 10);
  const { data: custom } = await supabase
    .from("PipelineStage")
    .select("*")
    .eq("userId", userId)
    .order("position", { ascending: true });

  if (!custom || custom.length === 0) {
    return NextResponse.json(DEFAULT_STAGES);
  }

  // Merge: custom stages override defaults by key; extra custom keys are appended
  const customByKey = Object.fromEntries(custom.map((s: Record<string, unknown>) => [s.key, s]));
  const merged: Record<string, unknown>[] = DEFAULT_STAGES.map((d) =>
    customByKey[d.key] ? { ...d, ...customByKey[d.key] } : d
  );
  // Append any custom stages whose key isn't in defaults
  const defaultKeys = new Set(DEFAULT_STAGES.map((d) => d.key));
  for (const s of custom) {
    if (!defaultKeys.has(s.key as string)) merged.push(s);
  }
  // Sort by position
  merged.sort((a, b) => ((a.position as number) ?? 0) - ((b.position as number) ?? 0));
  return NextResponse.json(merged);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  const body = await req.json();
  const { key, label, color, position } = body;
  if (!key || !label) {
    return NextResponse.json({ error: "key and label are required" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("PipelineStage")
    .insert({ userId, key, label, color: color ?? "gray", position: position ?? 0, isDefault: false })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  await supabase.from("PipelineStage").delete().eq("userId", userId);
  return NextResponse.json({ ok: true });
}
