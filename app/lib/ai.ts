// Conversational Text AI. Grounds Claude in a single business's setup answers
// and answers inbound SMS with the "relay, don't duplicate" role: carry the
// conversation forward with concrete next steps rather than restating things.
// Voice AI (phase 2) will share the same ConversationMessage memory.

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.AI_MODEL || 'claude-haiku-4-5-20251001';

export const aiConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

export interface AiTurn {
  role: 'inbound' | 'outbound';
  body: string;
}

export interface TextAgentContext {
  businessName: string;
  industry?: string | null;
  description?: string | null;
  hours?: string | null;
  services?: string | null;
  notOffered?: string | null;
  faqs?: string | null;
  emergency?: string | null;
  tone?: string | null;
  website?: string | null;
  location?: string | null;
  businessPhone?: string | null;
  // What to collect from every caller/texter (e.g. "Name, Phone, Reason, Address").
  collect?: string | null;
  // A sample text the business wants customers to get — used as a style guide.
  exampleMessage?: string | null;
  // Facts distilled from the business's website (see summarizeWebsite).
  siteSummary?: string | null;
  // Whether this contact just missed a call (so we relay, not cold-open).
  recentMissedCall?: boolean;
}

// Build the shared agent context from a business + its stored onboarding
// answers, so the live SMS webhook, the live Vapi webhook, and the admin
// Copy-Vapi panel all ground the assistant in exactly the same facts.
export function agentContextFrom(
  biz: { businessName: string },
  details: Record<string, string>,
): TextAgentContext {
  const location = [details.address, details.city, details.state, details.zip, details.country]
    .map((x) => (x || '').trim()).filter(Boolean).join(', ');
  return {
    businessName: biz.businessName,
    industry: details.industry,
    description: details.description,
    hours: details.hours,
    services: details.services,
    notOffered: details.notOffered,
    faqs: details.faqs,
    emergency: details.emergencyNotify,
    website: details.websiteUrl,
    location: location || undefined,
    businessPhone: details.businessPhone,
    collect: details.leadInfo,
    exampleMessage: details.exampleMessages,
    siteSummary: details.websiteSummary,
  };
}

function factsBlock(ctx: TextAgentContext): string {
  return [
    `- Name: ${ctx.businessName}`,
    ctx.industry ? `- Industry / trade: ${ctx.industry}` : '',
    ctx.description ? `- About: ${ctx.description}` : '',
    ctx.services ? `- Services/products: ${ctx.services}` : '',
    ctx.notOffered ? `- Does NOT offer: ${ctx.notOffered}` : '',
    ctx.hours ? `- Hours: ${ctx.hours}` : '',
    ctx.location ? `- Location / service area: ${ctx.location}` : '',
    ctx.businessPhone ? `- Main business phone: ${ctx.businessPhone}` : '',
    ctx.faqs ? `- FAQs: ${ctx.faqs}` : '',
    ctx.emergency ? `- What counts as an emergency: ${ctx.emergency}` : '',
    ctx.website ? `- Website: ${ctx.website}` : '',
    ctx.siteSummary ? `\nFROM THEIR WEBSITE (use these details when relevant):\n${ctx.siteSummary}` : '',
  ].filter(Boolean).join('\n');
}

// System prompt for the live Voice AI (phase 2, via Vapi). Distinct role from
// text: handle it in the moment — read tone, de-escalate, qualify, resolve or
// route — rather than restate. Shares the same business facts.
export function voiceSystemPrompt(ctx: TextAgentContext, opts?: { transferNumber?: string | null }): string {
  const collect = ctx.collect && ctx.collect.trim() ? ctx.collect.trim() : 'their name, phone number, and the reason for their call';
  return [
    `You are the phone assistant for ${ctx.businessName}, a real local business. You are on a LIVE phone call with someone who called and reached the business's missed-call line (the team could not pick up).`,
    ``,
    `IDENTITY & HONESTY:`,
    `- You are an A.I. assistant answering because the team couldn't get to the phone. If asked, say so plainly. Never claim to be a specific person or to physically do the work yourself.`,
    `- Use ONLY the business facts below. Never invent prices, availability, policies, or services. If you don't know, say you'll have the team confirm and follow up.`,
    ctx.siteSummary ? `- You have been briefed on this business from their own website (see "FROM THEIR WEBSITE" below). Lean on those specifics to answer confidently and sound like you genuinely know the business.` : '',
    ``,
    `YOUR JOB (voice channel): handle it live. Read the caller's tone and de-escalate if they're upset or it's urgent. Ask focused questions to understand what they need, answer what you can from the facts, and set up the next step (book, schedule, or arrange a callback).`,
    `- Collect from the caller before the call ends: ${collect}.`,
    opts?.transferNumber ? `- If the caller needs a person, or the request is beyond you, offer to connect them and transfer the call to the team.` : `- If the caller needs a person, take their details and tell them the team will call back shortly.`,
    ctx.emergency
      ? `- EMERGENCY RULE: if the situation matches "${ctx.emergency}", treat it as urgent — reassure the caller, tell them you're alerting the team right now, and make sure you have their name, number, and address.`
      : `- If the situation sounds urgent or unsafe, treat it as an emergency: reassure the caller and tell them you're alerting the team right away.`,
    `- Don't restate everything; keep moving forward, one question at a time.`,
    ``,
    `STYLE: speak like a warm, competent human at a small business. Keep turns short and natural for speech. Never read out URLs or long numbers unless asked.`,
    ctx.exampleMessage ? `- The business likes this style; match its warmth: "${ctx.exampleMessage.trim()}"` : '',
    ``,
    `BUSINESS FACTS (your only source of truth):`,
    factsBlock(ctx),
  ].filter(Boolean).join('\n');
}

// The Voice AI only answers AFTER the business misses the call (the line is
// forwarded on no-answer), so it opens by acknowledging that — not as if it were
// the main line picking up. Carries the Illinois two-party AI + recording
// disclosure. Shared by the live Vapi webhook and the admin Copy-Vapi panel so
// the two never drift.
export function voiceFirstMessage(businessName: string): string {
  return (
    `Hi! Thanks for calling ${businessName}. The team couldn't get to the phone right now, ` +
    `so I'm their A.I. assistant and I can help you out. Quick heads up, this call may be recorded. ` +
    `What can I help you with?`
  );
}

function buildSystemPrompt(ctx: TextAgentContext): string {
  const collect = ctx.collect && ctx.collect.trim() ? ctx.collect.trim() : 'their name, phone number, and the reason for reaching out';
  return [
    `You are the SMS assistant for ${ctx.businessName}, a real local business. You reply to customers by text on the business's behalf.`,
    ``,
    `YOUR JOB (text channel): move the conversation forward with concrete next steps — answer quick questions from the facts, collect what's needed, and set up the next action (booking, a callback, or a resolution). Do not just restate what was already said.`,
    `- Try to collect: ${collect}.`,
    ctx.siteSummary ? `- You've been briefed on this business from their website (see "FROM THEIR WEBSITE" below) — use those specifics to answer confidently.` : '',
    ``,
    `RELAY, DON'T DUPLICATE:`,
    ctx.recentMissedCall
      ? `- This person just called and reached your missed-call line. Acknowledge that briefly and move to the next step. Do NOT open with a generic "how can we help you today?" as if this were a cold text.`
      : `- If they reference an earlier call or text, build on it. Don't make them start over.`,
    ctx.emergency
      ? `- EMERGENCY RULE: if the situation matches "${ctx.emergency}", stop volleying texts — tell them you're flagging it to the team right now and offer to call them.`
      : `- If the situation is urgent or emotional (emergency, flooding, safety, an upset customer), stop volleying texts — tell them you're flagging it to the team right now and offer to call them.`,
    ``,
    `STYLE:`,
    `- Text like a helpful human at a small business.`,
    ctx.exampleMessage ? `- Match the tone of this example the business gave: "${ctx.exampleMessage.trim()}"` : '',
    `- Keep it short: 1-2 sentences, under ~300 characters. No markdown, no emojis unless the customer uses them.`,
    `- Only use the facts below. Never invent prices, availability, policies, or services. If you don't know, say you'll check with the team and get back to them.`,
    `- Don't claim to have booked or scheduled anything you can't actually do — say the team will confirm the details.`,
    ``,
    `BUSINESS FACTS (your only source of truth):`,
    factsBlock(ctx),
  ].filter(Boolean).join('\n');
}

// Generate a text reply. Returns { reply: null } (never throws) when AI is off
// or the call fails, so the SMS webhook degrades gracefully.
export async function generateTextReply(
  ctx: TextAgentContext,
  history: AiTurn[],
  inbound: string,
): Promise<{ reply: string | null; error?: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { reply: null, error: 'AI not configured' };

  const messages = [
    ...history.map((h) => ({ role: h.role === 'inbound' ? 'user' : 'assistant', content: h.body })),
    { role: 'user', content: inbound },
  ];

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 300, system: buildSystemPrompt(ctx), messages }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { reply: null, error: `AI ${res.status}: ${t.slice(0, 200)}` };
    }
    const data = await res.json();
    const text = Array.isArray(data?.content)
      ? data.content.filter((b: { type?: string }) => b.type === 'text').map((b: { text?: string }) => b.text || '').join('').trim()
      : '';
    return { reply: text || null };
  } catch (error) {
    console.error('Text AI error:', error);
    return { reply: null, error: error instanceof Error ? error.message : String(error) };
  }
}

// After a voice call, compose a short, friendly follow-up SMS to the caller —
// a quick recap + next step in the business's voice. Returns null (never throws)
// when AI is off or the call fails, so the caller just doesn't get a text.
export async function composeFollowUpText(
  businessName: string,
  callNotes: string,
): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !callNotes.trim()) return null;
  const system =
    `Write a single friendly SMS from ${businessName} to a customer who just called. ` +
    `1-2 sentences, under 300 characters, no markdown, no emojis unless natural. ` +
    `Briefly acknowledge what they called about and state the next step (someone will follow up / their request is logged). ` +
    `Do not invent prices, times, or promises. Do not add a signature or "Reply STOP" — that's added automatically. ` +
    `Output only the message text.`;
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 200, system, messages: [{ role: 'user', content: callNotes.slice(0, 4000) }] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const out = Array.isArray(data?.content)
      ? data.content.filter((b: { type?: string }) => b.type === 'text').map((b: { text?: string }) => b.text || '').join('').trim()
      : '';
    return out || null;
  } catch {
    return null;
  }
}

// Distill a business's website text into a compact facts sheet the phone/text
// assistants can rely on. Returns null (never throws) when AI is off or the call
// fails, so website scanning degrades gracefully.
export async function summarizeWebsite(
  businessName: string,
  rawText: string,
): Promise<{ summary: string | null; error?: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { summary: null, error: 'AI not configured' };
  const text = rawText.slice(0, 16000);
  if (!text.trim()) return { summary: null, error: 'No readable text on the page' };

  const system =
    `You extract facts from a local business's website so a phone/text assistant can answer customers accurately. ` +
    `Output a concise plain-text facts sheet for ${businessName} — no preamble, no markdown headers. ` +
    `Cover only what is actually on the page: services/products offered, anything they explicitly do NOT do, ` +
    `service area or locations, hours, pricing or free-estimate policies, guarantees/licensing, and 3-6 likely FAQs with short answers. ` +
    `Use short bullet-style lines. Never invent anything. Keep it under 250 words. ` +
    `If the text is not actually this business's site (parked page, error), reply exactly: NO_USABLE_CONTENT.`;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system, messages: [{ role: 'user', content: text }] }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { summary: null, error: `AI ${res.status}: ${t.slice(0, 200)}` };
    }
    const data = await res.json();
    const out = Array.isArray(data?.content)
      ? data.content.filter((b: { type?: string }) => b.type === 'text').map((b: { text?: string }) => b.text || '').join('').trim()
      : '';
    if (!out || out.includes('NO_USABLE_CONTENT')) return { summary: null, error: 'No usable content found on the site' };
    return { summary: out };
  } catch (error) {
    console.error('Website summarize error:', error);
    return { summary: null, error: error instanceof Error ? error.message : String(error) };
  }
}
