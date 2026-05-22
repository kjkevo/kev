import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data: leads, error } = await supabase
    .from("Lead")
    .select("id, companyName, contactName, status, dealValue, source, wonAt, lostAt, lossReason, assignedTo, createdAt, aiScore");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const STAGE_PROBABILITY: Record<string, number> = {
    new: 0.05, contacted: 0.10, qualified: 0.25,
    proposal: 0.50, negotiation: 0.75, won: 1.0, lost: 0,
  };

  const allLeads = leads ?? [];
  const won = allLeads.filter((l) => l.status === "won");
  const lost = allLeads.filter((l) => l.status === "lost");

  const newLeadsThisWeek = allLeads.filter((l) => new Date(l.createdAt) >= weekAgo).length;
  const dealsClosedThisWeek = won.filter((l) => l.wonAt && new Date(l.wonAt) >= weekAgo).length;
  const dealsLostThisWeek = lost.filter((l) => l.lostAt && new Date(l.lostAt) >= weekAgo).length;

  const pipelineValue = allLeads
    .filter((l) => l.dealValue != null && l.status !== "lost")
    .reduce((s, l) => s + (l.dealValue ?? 0), 0);

  const weightedPipeline = allLeads
    .filter((l) => l.dealValue != null)
    .reduce((s, l) => s + (l.dealValue ?? 0) * (STAGE_PROBABILITY[l.status] ?? 0), 0);

  const topLead = [...allLeads]
    .filter((l) => l.aiScore != null)
    .sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0))[0] ?? null;

  const lossReasonSummary: Record<string, number> = {};
  for (const l of lost) {
    const r = l.lossReason ?? "other";
    lossReasonSummary[r] = (lossReasonSummary[r] ?? 0) + 1;
  }

  return NextResponse.json({
    newLeadsThisWeek,
    dealsClosedThisWeek,
    dealsLostThisWeek,
    pipelineValue: Math.round(pipelineValue),
    weightedPipeline: Math.round(weightedPipeline),
    topLead: topLead
      ? { companyName: topLead.companyName, contactName: topLead.contactName, aiScore: topLead.aiScore }
      : null,
    lossReasonSummary,
  });
}
