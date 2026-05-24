import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import { logAudit } from "@/app/lib/audit";

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

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : null;
  const userName = session?.user?.name ?? session?.user?.email ?? null;

  const body = await req.json();

  const { data: activity, error } = await supabase
    .from("Activity")
    .insert({
      leadId,
      type: body.type,
      content: body.content,
      date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
      userId: userId ?? null,
      userName: userName ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Process @mentions for note-type activities
  if (activity && body.type === "Note" && body.content) {
    await processMentions(body.content, activity.id, leadId, userId);
  }

  logAudit({
    userId: userId ?? undefined,
    userEmail: session?.user?.email ?? undefined,
    action: "activity.logged",
    entityType: "Activity",
    entityId: activity?.id,
    meta: { leadId, type: body.type },
  });

  return NextResponse.json(activity, { status: 201 });
}

async function processMentions(content: string, activityId: number, leadId: number, authorId: number | null) {
  // Extract @name tokens (e.g. @John, @John Doe handled as @John)
  const mentionRegex = /@([a-zA-Z][a-zA-Z0-9_\-. ]*?)(?=\s|$|[^a-zA-Z0-9_\-. ])/g;
  const matches = [...content.matchAll(mentionRegex)];
  if (matches.length === 0) return;

  const names = [...new Set(matches.map((m) => m[1].trim()))];

  for (const name of names) {
    // Find user(s) whose name starts with or matches this mention token
    const { data: users } = await supabase
      .from("User")
      .select("id, name, email")
      .ilike("name", `${name}%`);

    for (const user of users ?? []) {
      if (user.id === authorId) continue; // don't notify the author
      const snippet = content.length > 80 ? content.slice(0, 80) + "…" : content;
      await supabase.from("Notification").insert({
        userId: user.id,
        type: "mention",
        content: `You were mentioned in a note: "${snippet}"`,
        read: false,
        leadId,
        activityId,
      });
    }
  }
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
