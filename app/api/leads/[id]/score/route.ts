import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Rule-based lead scoring — no external API required
// ---------------------------------------------------------------------------

function scoreLead(lead: Record<string, unknown>, activityCount: number): { score: number; reason: string } {
  let score = 40;
  const reasons: string[] = [];

  const trigger = String(lead.triggerEvent ?? "").toLowerCase();
  const intel = String(lead.intelligenceSummary ?? "").toLowerCase();
  const status = String(lead.status ?? "new").toLowerCase();
  const tags = ((lead.tags as string[]) ?? []).map((t) => t.toLowerCase());

  // ── Status bonus ────────────────────────────────────────────────────────
  const statusBonus: Record<string, number> = {
    new: 0, contacted: 5, qualified: 15, proposal: 25, negotiation: 35, won: 50, lost: -30,
  };
  score += statusBonus[status] ?? 0;
  if (status === "negotiation") reasons.push("actively in negotiation");
  else if (status === "proposal") reasons.push("reached proposal stage");
  else if (status === "qualified") reasons.push("lead is qualified");

  // ── Trigger signals ──────────────────────────────────────────────────────
  if (/series [a-z]|raised \$|funding round|secured \$|\$\d+m/.test(trigger)) {
    score += 20; reasons.push("recent funding event shows buying power");
  } else if (/seed|pre-seed|angel round/.test(trigger)) {
    score += 8; reasons.push("early-stage funding detected");
  }
  if (/competitor|switched from|replaced|evaluating|moving away/.test(trigger)) {
    score += 18; reasons.push("actively evaluating competitors — high intent");
  }
  if (/pricing page|demo request|free trial|signed up|booked a call/.test(trigger)) {
    score += 22; reasons.push("bottom-of-funnel buying signal");
  }
  if (/hiring|job posting|recruiting|growing team/.test(trigger)) {
    score += 10; reasons.push("scaling team signals growth and budget");
  }

  // ── Intelligence signals ─────────────────────────────────────────────────
  if (/budget approved|greenlit|signed off|has budget/.test(intel)) {
    score += 20; reasons.push("budget already approved");
  }
  if (/ceo|cto|vp |director|head of|decision maker/.test(intel)) {
    score += 10; reasons.push("direct contact with decision maker");
  }
  if (/replied|responded|called back|very interested|eager/.test(intel)) {
    score += 12; reasons.push("lead has shown strong engagement");
  }
  if (/urgent|asap|this quarter|q[1-4] deadline|end of month/.test(intel + " " + trigger)) {
    score += 15; reasons.push("time-sensitive urgency signals");
  }

  // ── Activity engagement ──────────────────────────────────────────────────
  if (activityCount >= 5) { score += 15; reasons.push(`${activityCount} logged touchpoints show high engagement`); }
  else if (activityCount >= 2) { score += 7; reasons.push(`${activityCount} interactions recorded`); }

  // ── Tags ──────────────────────────────────────────────────────────────────
  if (tags.some((t) => /hot|urgent|priority|vip|key account/.test(t))) {
    score += 12; reasons.push("tagged as high-priority");
  }

  // ── Clamp to 5–99 ────────────────────────────────────────────────────────
  score = Math.max(5, Math.min(99, score));

  // ── Build human-readable reason ──────────────────────────────────────────
  let reason: string;
  if (reasons.length === 0) {
    reason =
      score >= 70 ? "Strong profile across multiple dimensions — prioritise this lead."
      : score >= 45 ? "Moderate potential — one or two more touchpoints should qualify them."
      : "Early-stage lead. Keep nurturing and look for buying signals.";
  } else {
    const top = reasons.slice(0, 3).join(", ");
    reason =
      score >= 70 ? `Hot lead (${score}/100) — ${top}.`
      : score >= 45 ? `Warm lead (${score}/100) — ${top}.`
      : `Cool lead (${score}/100) — ${top}. Needs more engagement.`;
    reason = reason.charAt(0).toUpperCase() + reason.slice(1);
  }

  return { score, reason };
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { data: lead, error } = await supabase.from("Lead").select("*").eq("id", id).single();
  if (error || !lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { count: activityCount } = await supabase
    .from("Activity").select("*", { count: "exact", head: true }).eq("leadId", id);

  const { score, reason } = scoreLead(lead as Record<string, unknown>, activityCount ?? 0);

  await supabase.from("Lead").update({ aiScore: score, aiScoreReason: reason }).eq("id", id);

  return NextResponse.json({ score, reason });
}
