import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const { type, content } = body as { type: string; content: string };

  const { data: lead, error: leadErr } = await supabase
    .from("Lead")
    .select("*")
    .eq("id", id)
    .single();

  if (leadErr || !lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const prompt = `You are a B2B sales coach. Based on this lead and their recent activity, suggest the single best next action. Return ONLY valid JSON: {"suggestion": "<one actionable sentence>"}

Lead: ${lead.companyName}, ${lead.contactName} (${lead.title})
Status: ${lead.status}
Recent activity: [${type}] ${content}`;

  try {
    const msg = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (msg.content[0] as { type: "text"; text: string }).text;
    const parsed = JSON.parse(text) as { suggestion: string };

    const { error: updateErr } = await supabase
      .from("Lead")
      .update({ aiSuggestion: parsed.suggestion })
      .eq("id", id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ suggestion: parsed.suggestion });
  } catch (err) {
    console.error("AI suggestion error:", err);
    return NextResponse.json({ error: "AI suggestion failed" }, { status: 500 });
  }
}
