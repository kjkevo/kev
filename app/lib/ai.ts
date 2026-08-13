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
  hours?: string | null;
  services?: string | null;
  notOffered?: string | null;
  faqs?: string | null;
  emergency?: string | null;
  tone?: string | null;
  website?: string | null;
  // Whether this contact just missed a call (so we relay, not cold-open).
  recentMissedCall?: boolean;
}

function buildSystemPrompt(ctx: TextAgentContext): string {
  const facts = [
    `- Name: ${ctx.businessName}`,
    ctx.industry ? `- Industry: ${ctx.industry}` : '',
    ctx.hours ? `- Hours: ${ctx.hours}` : '',
    ctx.services ? `- Services/products: ${ctx.services}` : '',
    ctx.notOffered ? `- Does NOT offer: ${ctx.notOffered}` : '',
    ctx.faqs ? `- FAQs: ${ctx.faqs}` : '',
    ctx.emergency ? `- What counts as an emergency + who to notify: ${ctx.emergency}` : '',
    ctx.website ? `- Website: ${ctx.website}` : '',
  ].filter(Boolean).join('\n');

  return [
    `You are the SMS assistant for ${ctx.businessName}, a real local business. You reply to customers by text on the business's behalf.`,
    ``,
    `YOUR JOB (text channel): move the conversation forward with concrete next steps — answer quick questions, share info, collect what's needed, and set up the next action (booking, a callback, or a resolution). Do not just restate what was already said.`,
    ``,
    `RELAY, DON'T DUPLICATE:`,
    ctx.recentMissedCall
      ? `- This person just called and reached your missed-call line. Acknowledge that briefly and move to the next step. Do NOT open with a generic "how can we help you today?" as if this were a cold text.`
      : `- If they reference an earlier call or text, build on it. Don't make them start over.`,
    `- If the situation is urgent or emotional (emergency, flooding, safety, an upset caller), stop volleying texts — tell them you're flagging it to the team right now and offer to call them.`,
    ``,
    `STYLE:`,
    `- Text like a helpful human at a small business.${ctx.tone ? ` Tone: ${ctx.tone}.` : ''}`,
    `- Keep it short: 1-2 sentences, under ~300 characters. No markdown, no emojis unless the customer uses them.`,
    `- Only use the facts below. Never invent prices, availability, policies, or services. If you don't know, say you'll check with the team and get back to them.`,
    `- Don't claim to have booked or scheduled anything you can't actually do — say the team will confirm the details.`,
    ``,
    `BUSINESS FACTS (your only source of truth):`,
    facts,
  ].join('\n');
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
