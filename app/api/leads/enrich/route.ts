import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { domain } = body as { domain: string };

  if (!domain) return NextResponse.json({ error: "domain is required" }, { status: 400 });

  const prompt = `You are a company research assistant. Given the email domain "${domain}", return ONLY valid JSON with company information: {"companyName": "...", "industry": "...", "size": "...", "website": "https://..."}. If you don't know, make reasonable inferences. Return JSON only.`;

  try {
    const msg = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (msg.content[0] as { type: "text"; text: string }).text;
    const parsed = JSON.parse(text) as {
      companyName: string;
      industry: string;
      size: string;
      website: string;
    };

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Enrichment error:", err);
    return NextResponse.json({ error: "Enrichment failed" }, { status: 500 });
  }
}
