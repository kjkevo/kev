/**
 * enrichLeads.ts
 *
 * Simulates an Apify / Browse.ai data pipeline:
 *   1. Accepts raw company rows (scraped or hand-crafted)
 *   2. Calls the Claude API to produce a triggerEvent + intelligenceSummary
 *   3. Upserts every enriched lead into the Prisma SQLite database
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/enrichLeads.ts
 *
 * Environment variables required:
 *   DATABASE_URL     – already set in .env  (e.g. "file:./prisma/dev.db")
 *   ANTHROPIC_API_KEY – your Anthropic key   (add to .env)
 */

import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";

// Validate required env vars before doing any work
const missingVars = ["DATABASE_URL", "ANTHROPIC_API_KEY"].filter(
  (k) => !process.env[k]
);
if (missingVars.length > 0) {
  console.error(
    `\nMissing required environment variables: ${missingVars.join(", ")}\n` +
      `Add them to your .env file and re-run the script.\n`
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw shape coming out of a scraper (Apify actor, Browse.ai run, etc.) */
interface RawCompanyData {
  companyName: string;
  website?: string;
  contactName: string;
  title: string;
  email: string;
  phone?: string;
  /** Free-form context the scraper collected – job posts, news, LinkedIn blurbs, etc. */
  rawContext: string;
}

interface EnrichedLead {
  companyName: string;
  website?: string;
  contactName: string;
  title: string;
  email: string;
  phone?: string;
  triggerEvent: string;
  intelligenceSummary: string;
}

// ---------------------------------------------------------------------------
// Sample raw data (replace / augment with real Apify / Browse.ai output)
// ---------------------------------------------------------------------------

const RAW_LEADS: RawCompanyData[] = [
  {
    companyName: "NovaBuild",
    website: "https://novabuild.io",
    contactName: "Elena Torres",
    title: "VP of Engineering",
    email: "elena.torres@novabuild.io",
    phone: "+1-415-555-0212",
    rawContext:
      "NovaBuild posted 8 new DevOps / SRE roles on LinkedIn this week. " +
      "Their CTO published a blog post titled 'Scaling to 1M users: what we got wrong'. " +
      "Series B of $18M announced on TechCrunch yesterday.",
  },
  {
    companyName: "PulseMetrics",
    website: "https://pulsemetrics.com",
    contactName: "Jordan Kim",
    title: "Head of Growth",
    email: "j.kim@pulsemetrics.com",
    rawContext:
      "PulseMetrics left a negative G2 review of their current analytics vendor citing 'lack of enterprise SSO'. " +
      "They are hiring a Senior Data Engineer and a Marketing Ops Manager simultaneously. " +
      "Jordan Kim recently liked three LinkedIn posts about switching analytics stacks.",
  },
  {
    companyName: "FrameworkAI",
    website: "https://frameworkai.dev",
    contactName: "Sam Okafor",
    title: "CEO",
    email: "sam@frameworkai.dev",
    phone: "+1-512-555-0087",
    rawContext:
      "FrameworkAI attended our 'AI-Powered Revenue Operations' webinar and Sam Okafor sent a follow-up email " +
      "asking about enterprise pricing. Company headcount grew 40% in the last 6 months per LinkedIn. " +
      "Currently using a competitor product according to their public job descriptions.",
  },
];

// ---------------------------------------------------------------------------
// Claude enrichment
// ---------------------------------------------------------------------------

const client = new Anthropic();

async function enrichWithClaude(raw: RawCompanyData): Promise<{
  triggerEvent: string;
  intelligenceSummary: string;
}> {
  const prompt = `You are a B2B sales intelligence analyst.
Given the raw context about a company and contact below, produce two things:

1. triggerEvent   – one concise sentence (≤ 25 words) describing the single most compelling buying signal.
2. intelligenceSummary – two to three sentences explaining WHY this lead is highly valuable for a sales team RIGHT NOW, referencing specific signals from the context.

Raw context:
Company: ${raw.companyName}
Contact: ${raw.contactName}, ${raw.title}
Website: ${raw.website ?? "unknown"}
Scraped context: ${raw.rawContext}

Reply with valid JSON only, matching this shape exactly:
{
  "triggerEvent": "...",
  "intelligenceSummary": "..."
}`;

  const stream = await client.messages.stream({
    model: "claude-opus-4-7",
    max_tokens: 512,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
  });

  const message = await stream.getFinalMessage();

  // Extract the text block (thinking blocks are separate)
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`No text block in response for ${raw.companyName}`);
  }

  // Strip markdown code fences if the model wraps the JSON
  const rawText = textBlock.text.replace(/```(?:json)?\n?/g, "").trim();
  const parsed = JSON.parse(rawText) as {
    triggerEvent: string;
    intelligenceSummary: string;
  };

  return parsed;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

async function runPipeline(rawLeads: RawCompanyData[]): Promise<void> {
  const prisma = new PrismaClient();

  console.log(`\nStarting enrichment pipeline for ${rawLeads.length} lead(s)…\n`);

  const enriched: EnrichedLead[] = [];

  for (const raw of rawLeads) {
    process.stdout.write(`  Enriching ${raw.companyName} (${raw.email})… `);
    try {
      const { triggerEvent, intelligenceSummary } = await enrichWithClaude(raw);
      enriched.push({ ...raw, triggerEvent, intelligenceSummary });
      console.log("done ✓");
    } catch (err) {
      console.error(`\n  ✗ Failed to enrich ${raw.companyName}:`, err);
    }
  }

  console.log(`\nSaving ${enriched.length} enriched lead(s) to the database…\n`);

  let saved = 0;
  for (const lead of enriched) {
    await prisma.lead.upsert({
      where: { email: lead.email },
      update: {
        triggerEvent: lead.triggerEvent,
        intelligenceSummary: lead.intelligenceSummary,
        companyName: lead.companyName,
        website: lead.website,
        contactName: lead.contactName,
        title: lead.title,
        phone: lead.phone,
      },
      create: {
        companyName: lead.companyName,
        website: lead.website,
        contactName: lead.contactName,
        title: lead.title,
        email: lead.email,
        phone: lead.phone,
        triggerEvent: lead.triggerEvent,
        intelligenceSummary: lead.intelligenceSummary,
      },
    });
    console.log(`  Saved: ${lead.companyName} — ${lead.triggerEvent}`);
    saved++;
  }

  await prisma.$disconnect();
  console.log(`\nPipeline complete. ${saved} lead(s) upserted.\n`);
}

// ---------------------------------------------------------------------------
// Entry point – swap RAW_LEADS for a live Apify/Browse.ai fetch as needed
// ---------------------------------------------------------------------------

runPipeline(RAW_LEADS).catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
