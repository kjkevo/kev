/**
 * testProduction.ts
 *
 * End-to-end smoke test for the live production pipeline.
 * Runs against the real DATABASE_URL and ANTHROPIC_API_KEY — safe to
 * execute against production because it inserts with a .invalid TLD email
 * and deletes the record when done.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/testProduction.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/testProduction.ts --keep
 *
 * Flags:
 *   --keep   Skip cleanup so you can inspect the test record in the DB / Prisma Studio.
 *
 * Exit codes:
 *   0  all steps passed
 *   1  one or more steps failed, or a required env var is missing
 */

import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const KEEP_RECORD = process.argv.includes("--keep");

// .invalid TLD (RFC 2606) — can never be a real address, can never collide
// with live leads. Timestamp suffix guarantees uniqueness across runs.
const TEST_EMAIL = `leadiq-smoketest+${Date.now()}@test.invalid`;

const TEST_RAW = {
  companyName: "SmokeTest Corp",
  website: "https://smoketest.invalid",
  contactName: "Alice Testington",
  title: "VP of Engineering",
  email: TEST_EMAIL,
  phone: "+1-555-000-0001",
  rawContext:
    "SmokeTest Corp announced a $30M Series B last week and is actively posting " +
    "8 senior DevOps roles on LinkedIn. Their CTO published a blog post titled " +
    "'Why we are migrating our entire infrastructure stack in Q3'. Company " +
    "headcount grew 60% in the past 6 months.",
};

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

const pass = `${C.green}✓ PASS${C.reset}`;
const fail = `${C.red}✗ FAIL${C.reset}`;

function pad(s: string, width: number): string {
  return s + " ".repeat(Math.max(0, width - s.length));
}

function ms(n: number): string {
  return n >= 1000
    ? `${C.dim}(${(n / 1000).toFixed(2)}s)${C.reset}`
    : `${C.dim}(${n}ms)${C.reset}`;
}

// ---------------------------------------------------------------------------
// Step runner
// ---------------------------------------------------------------------------

type StepResult = {
  name: string;
  passed: boolean;
  durationMs: number;
  detail?: string;
  error?: string;
};

const LABEL_WIDTH = 42;

async function runStep(
  label: string,
  fn: () => Promise<string | void>
): Promise<StepResult> {
  process.stdout.write(pad(label, LABEL_WIDTH));
  const start = Date.now();
  try {
    const detail = await fn();
    const durationMs = Date.now() - start;
    console.log(`${pass}  ${ms(durationMs)}`);
    if (detail) console.log(`${C.dim}   ${detail}${C.reset}`);
    return { name: label, passed: true, durationMs, detail };
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    console.log(`${fail}  ${ms(durationMs)}`);
    console.log(`${C.red}   ${message}${C.reset}`);
    return { name: label, passed: false, durationMs, error: message };
  }
}

// ---------------------------------------------------------------------------
// Enrichment (mirrors enrichLeads.ts — self-contained so this script has no
// local imports and can be run independently against any environment)
// ---------------------------------------------------------------------------

async function callClaudeEnrichment(raw: typeof TEST_RAW): Promise<{
  triggerEvent: string;
  intelligenceSummary: string;
}> {
  const client = new Anthropic();

  const prompt = `You are a B2B sales intelligence analyst.
Given the raw context about a company and contact below, produce two things:

1. triggerEvent   – one concise sentence (≤ 25 words) describing the single most compelling buying signal.
2. intelligenceSummary – two to three sentences explaining WHY this lead is highly valuable for a sales team RIGHT NOW.

Raw context:
Company: ${raw.companyName}
Contact: ${raw.contactName}, ${raw.title}
Website: ${raw.website}
Scraped context: ${raw.rawContext}

Reply with valid JSON only — no markdown fences, no extra keys:
{"triggerEvent":"...","intelligenceSummary":"..."}`;

  const stream = await client.messages.stream({
    model: "claude-opus-4-7",
    max_tokens: 512,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
  });

  const message = await stream.getFinalMessage();

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text block in Claude response");
  }

  const rawText = textBlock.text.replace(/```(?:json)?\n?/g, "").trim();
  const parsed = JSON.parse(rawText) as {
    triggerEvent: string;
    intelligenceSummary: string;
  };

  return parsed;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // ── Header ────────────────────────────────────────────────────────────────
  console.log();
  console.log(
    `${C.bold}${C.cyan}  LeadIQ — Production Smoke Test${C.reset}`
  );
  console.log(`${C.dim}  ${new Date().toISOString()}${C.reset}`);
  console.log(`${C.dim}  test email: ${TEST_EMAIL}${C.reset}`);
  if (KEEP_RECORD) {
    console.log(`${C.yellow}  --keep: test record will NOT be deleted${C.reset}`);
  }
  console.log();

  const results: StepResult[] = [];
  const prisma = new PrismaClient();
  let enriched: { triggerEvent: string; intelligenceSummary: string } | null =
    null;

  // We use try/finally so cleanup always runs, even when a step throws.
  try {
    // ── Step 1: env vars ───────────────────────────────────────────────────
    results.push(
      await runStep("[1/5] Environment variables", async () => {
        const missing = ["DATABASE_URL", "ANTHROPIC_API_KEY"].filter(
          (k) => !process.env[k]
        );
        if (missing.length > 0) {
          throw new Error(`Missing: ${missing.join(", ")}`);
        }
        const dbHost = new URL(process.env.DATABASE_URL!).hostname;
        return `DB host: ${dbHost}`;
      })
    );

    // Abort early — later steps will all fail if env is broken.
    if (!results[0].passed) {
      throw new Error("Aborting: required environment variables are missing.");
    }

    // ── Step 2: database connectivity ─────────────────────────────────────
    results.push(
      await runStep("[2/5] Database connectivity", async () => {
        // A raw query is the fastest connectivity check — no table dependency.
        const rows = await prisma.$queryRaw<[{ one: number }]>`SELECT 1 AS one`;
        if (!rows[0] || rows[0].one !== 1) {
          throw new Error("Unexpected query result");
        }
        const count = await prisma.lead.count();
        return `SELECT 1 OK · ${count} existing lead(s) in table`;
      })
    );

    // ── Step 3: insert raw lead ────────────────────────────────────────────
    results.push(
      await runStep("[3/5] Insert raw lead → database", async () => {
        await prisma.lead.create({
          data: {
            companyName: TEST_RAW.companyName,
            website: TEST_RAW.website,
            contactName: TEST_RAW.contactName,
            title: TEST_RAW.title,
            email: TEST_RAW.email,
            phone: TEST_RAW.phone,
            // Placeholder values overwritten in step 4
            triggerEvent: "__pending_enrichment__",
            intelligenceSummary: "__pending_enrichment__",
          },
        });
        return `Inserted with email: ${TEST_EMAIL}`;
      })
    );

    // ── Step 4: Claude enrichment ──────────────────────────────────────────
    results.push(
      await runStep("[4/5] Claude AI enrichment", async () => {
        enriched = await callClaudeEnrichment(TEST_RAW);

        // Validate the shape before touching the DB
        if (typeof enriched.triggerEvent !== "string" || enriched.triggerEvent.trim().length < 10) {
          throw new Error("triggerEvent is empty or too short");
        }
        if (typeof enriched.intelligenceSummary !== "string" || enriched.intelligenceSummary.trim().length < 20) {
          throw new Error("intelligenceSummary is empty or too short");
        }
        if (enriched.triggerEvent.length > 500) {
          throw new Error("triggerEvent suspiciously long — possible hallucination");
        }

        // Write enrichment back to the record
        await prisma.lead.update({
          where: { email: TEST_EMAIL },
          data: {
            triggerEvent: enriched.triggerEvent,
            intelligenceSummary: enriched.intelligenceSummary,
          },
        });

        return (
          `trigger: "${enriched.triggerEvent.slice(0, 80)}${enriched.triggerEvent.length > 80 ? "…" : ""}"`
        );
      })
    );

    // ── Step 5: read-back and field validation ─────────────────────────────
    results.push(
      await runStep("[5/5] Read-back & field validation", async () => {
        const record = await prisma.lead.findUniqueOrThrow({
          where: { email: TEST_EMAIL },
        });

        const checks: string[] = [];

        if (record.email !== TEST_EMAIL) {
          throw new Error(`email mismatch: got "${record.email}"`);
        }
        checks.push("email ✓");

        if (record.triggerEvent === "__pending_enrichment__") {
          throw new Error("triggerEvent was never written");
        }
        if (enriched && record.triggerEvent !== enriched.triggerEvent) {
          throw new Error("triggerEvent does not match what Claude returned");
        }
        checks.push("triggerEvent ✓");

        if (record.intelligenceSummary === "__pending_enrichment__") {
          throw new Error("intelligenceSummary was never written");
        }
        checks.push("intelligenceSummary ✓");

        if (!(record.createdAt instanceof Date) || isNaN(record.createdAt.getTime())) {
          throw new Error("createdAt is not a valid Date");
        }
        checks.push("createdAt ✓");

        return checks.join(" · ");
      })
    );
  } finally {
    // ── Cleanup ───────────────────────────────────────────────────────────
    if (KEEP_RECORD) {
      console.log();
      console.log(
        `${C.yellow}  Skipping cleanup (--keep). ` +
          `Inspect the record with: npm run db:studio${C.reset}`
      );
    } else {
      process.stdout.write(pad("  Cleanup: deleting test record", LABEL_WIDTH));
      try {
        await prisma.lead.deleteMany({ where: { email: TEST_EMAIL } });
        console.log(pass);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`${C.yellow}⚠ could not delete: ${msg}${C.reset}`);
        console.log(
          `${C.dim}  Delete manually: DELETE FROM "Lead" WHERE email = '${TEST_EMAIL}';${C.reset}`
        );
      }
    }

    await prisma.$disconnect();
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalMs = results.reduce((acc, r) => acc + r.durationMs, 0);

  console.log();
  console.log(`  ${"─".repeat(LABEL_WIDTH + 16)}`);

  if (failed === 0) {
    console.log(
      `  ${C.green}${C.bold}${passed} passed${C.reset}` +
        `  ·  ${C.dim}0 failed${C.reset}` +
        `  ·  total: ${(totalMs / 1000).toFixed(2)}s`
    );
  } else {
    console.log(
      `  ${C.green}${passed} passed${C.reset}` +
        `  ·  ${C.red}${C.bold}${failed} failed${C.reset}` +
        `  ·  total: ${(totalMs / 1000).toFixed(2)}s`
    );
  }

  console.log(`  ${"─".repeat(LABEL_WIDTH + 16)}`);
  console.log();

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n${C.red}Fatal:${C.reset}`, err instanceof Error ? err.message : err);
  process.exit(1);
});
