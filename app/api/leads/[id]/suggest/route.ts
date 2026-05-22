import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Rule-based follow-up suggestions — no external API required
// ---------------------------------------------------------------------------

function getSuggestion(
  activityType: string,
  activityContent: string,
  status: string,
  companyName: string,
  contactName: string
): string {
  const content = activityContent.toLowerCase();
  const type = activityType.toLowerCase();

  // Content-driven suggestions (highest priority)
  if (/budget|approved|greenlit|signed off/.test(content)) {
    return `Budget is confirmed — send a formal proposal to ${contactName} at ${companyName} today while the momentum is high.`;
  }
  if (/next week|next month|follow.?up|check back|circle back/.test(content)) {
    return `They asked you to follow up — schedule a calendar reminder and send a brief value-add email in the meantime.`;
  }
  if (/not interested|no budget|bad timing|passed/.test(content)) {
    return `Mark as lost and set a 90-day re-engagement task — timing objections often resolve next quarter.`;
  }
  if (/competitor|evaluating|comparing|looking at/.test(content)) {
    return `Send a competitive battle card or case study that highlights your key differentiators over their alternatives.`;
  }
  if (/demo|trial|test|poc/.test(content)) {
    return `Follow up 24 hours post-demo with a summary email and a specific next step (e.g. proposal or pilot scope).`;
  }
  if (/pricing|cost|budget|afford/.test(content)) {
    return `They're asking about pricing — send a tailored proposal with clear ROI numbers within the next 24 hours.`;
  }
  if (/voicemail|no answer|missed/.test(content)) {
    return `Send a brief email with a specific question to get a reply — avoid generic "just checking in" messages.`;
  }

  // Activity type + status combinations
  if (type === "call") {
    if (status === "new" || status === "contacted") {
      return `Great first call with ${companyName}! Send a follow-up email within 2 hours summarising what was discussed and a clear next step.`;
    }
    if (status === "qualified") {
      return `Schedule a technical deep-dive or demo with ${contactName} — strike while the conversation is fresh.`;
    }
    if (status === "proposal") {
      return `Follow up on the proposal you sent — ask if they have any questions and suggest a brief 15-minute call to walk through it.`;
    }
    return `Send a personalised follow-up email to ${contactName} within 24 hours to keep the momentum going.`;
  }

  if (type === "email") {
    if (status === "new") {
      return `If no reply in 3 business days, try a short LinkedIn message or phone call — multi-channel outreach gets 3× more responses.`;
    }
    if (status === "contacted" || status === "qualified") {
      return `If no reply in 48 hours, send one concise follow-up referencing a specific pain point relevant to ${companyName}.`;
    }
    return `Give it 2–3 business days then follow up with added value — share a relevant case study or industry insight.`;
  }

  if (type === "meeting") {
    if (status === "qualified" || status === "proposal") {
      return `Send a formal proposal to ${contactName} within 24 hours while the meeting is fresh in their mind.`;
    }
    if (status === "negotiation") {
      return `Document the agreed terms and send a summary email — lock in the next decision-maker touchpoint before end of week.`;
    }
    return `Send a meeting recap email to ${contactName} at ${companyName} with agreed next steps and timeline.`;
  }

  if (type === "note") {
    if (status === "new") return `This lead is at an early stage — consider a personalised outreach email to start the conversation.`;
    if (status === "negotiation") return `You're close — identify any remaining objections and schedule a call to address them directly.`;
    return `Review your notes and plan the next touchpoint — consistency wins deals with ${companyName}.`;
  }

  // Generic fallback by status
  const statusSuggestions: Record<string, string> = {
    new: `Research ${companyName} and craft a personalised cold outreach message referencing their recent trigger event.`,
    contacted: `Follow up with ${contactName} at ${companyName} — most deals close after 5+ touchpoints.`,
    qualified: `Book a discovery call this week to understand ${companyName}'s specific use case and timeline.`,
    proposal: `Check if the proposal was received and offer a 15-minute call to answer any questions.`,
    negotiation: `Prepare your BATNA and schedule a closing call with ${contactName} — you're in the home stretch.`,
    won: `Kick off the onboarding process and ask ${contactName} for a referral or case study testimonial.`,
    lost: `Send a gracious farewell email and add a 90-day re-engagement reminder — 30% of lost deals return.`,
  };

  return statusSuggestions[status] ?? `Keep nurturing ${contactName} at ${companyName} with relevant, personalised outreach.`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json() as { type?: string; content?: string };
  const { type = "Note", content = "" } = body;

  const { data: lead, error } = await supabase.from("Lead").select("*").eq("id", id).single();
  if (error || !lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const suggestion = getSuggestion(
    type,
    content,
    String(lead.status ?? "new"),
    String(lead.companyName ?? ""),
    String(lead.contactName ?? "")
  );

  await supabase.from("Lead").update({ aiSuggestion: suggestion }).eq("id", id);

  return NextResponse.json({ suggestion });
}
