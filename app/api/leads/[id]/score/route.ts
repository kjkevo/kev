import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(
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

  const prompt = `You are a B2B sales assistant. Analyze this lead and score their buying potential from 0-100. Return ONLY valid JSON: {"score": <number>, "reason": "<1-2 sentence explanation why>"}

Lead profile:
- Company: ${lead.companyName}
- Contact: ${lead.contactName}, ${lead.title}
- Trigger event: ${lead.triggerEvent}
- Intelligence: ${lead.intelligenceSummary}
- Status: ${lead.status}
- Tags: ${(lead.tags ?? []).join(", ") || "none"}`;

  try {
    const msg = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (msg.content[0] as { type: "text"; text: string }).text;
    const parsed = JSON.parse(text) as { score: number; reason: string };

    const { data: updated, error: updateErr } = await supabase
      .from("Lead")
      .update({ aiScore: parsed.score, aiScoreReason: parsed.reason })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ score: parsed.score, reason: parsed.reason, lead: updated });
  } catch (err) {
    console.error("AI scoring error:", err);
    return NextResponse.json({ error: "AI scoring failed" }, { status: 500 });
  }
}
