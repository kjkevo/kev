// Deterministic sample conversations for the /welcome review page. Built purely
// from a client's own setup answers (no AI call, no server imports) so the
// preview is instant, free, and always matches the current behavior. The point
// is reassurance: the client sees, before going live, roughly how a real text or
// call will read — grounded only in the facts they gave us.

export type Turn = { who: 'customer' | 'ai' | 'note'; text: string };

export interface SampleConversation {
  title: string;
  channel: 'text' | 'voice';
  turns: Turn[];
}

export interface SampleFacts {
  businessName: string;
  industry?: string | null;
  hours?: string | null;
  emergencyNotify?: string | null;
  tone?: string | null;
  missedCallMessage?: string | null; // the actual text-back we'll send
  voiceGreeting?: string | null;
  smsEnabled: boolean;
  voiceEnabled: boolean;
}

// Mirrors ai.ts `voiceFirstMessage` so the preview matches the live opener.
// Kept here (client-safe) rather than importing the server module. Keep in sync.
function voiceOpener(businessName: string): string {
  return (
    `Hi! Thanks for calling ${businessName}. The team couldn't get to the phone right now, ` +
    `so I'm their assistant and I can help you out. Quick heads up, this call may be recorded. ` +
    `What can I help you with?`
  );
}

function fill(text: string, businessName: string): string {
  return (text || '').replace(/\{BUSINESS_NAME\}/g, businessName).replace(/\{NAME\}/g, 'Jordan');
}

// First listed industry/trade, lowercased, for a believable customer line.
function trade(industry?: string | null): string {
  const first = (industry || '').split(/[,/]/)[0].trim().toLowerCase();
  return first || 'what you offer';
}

export function buildSamples(f: SampleFacts): SampleConversation[] {
  const name = f.businessName || 'your business';
  const casual = !f.tone || /friendly|casual/i.test(f.tone);
  const hoursLine = f.hours ? `We're open ${f.hours}. ` : '';
  const out: SampleConversation[] = [];

  // 1) Text-back exchange
  if (f.smsEnabled) {
    const back = fill(f.missedCallMessage || `Sorry we missed your call! This is ${name} — what can we help you with?`, name);
    const reply = casual
      ? `Happy to help! ${hoursLine}What's your name and what do you need, and I'll get the team on it — they'll confirm the details.`
      : `Certainly. ${hoursLine}Please share your name and what you need, and our team will follow up to confirm the details.`;
    out.push({
      title: 'A missed call turns into a text',
      channel: 'text',
      turns: [
        { who: 'note', text: 'You miss a call — Slimpse texts the customer back within seconds.' },
        { who: 'ai', text: back },
        { who: 'customer', text: `Hi, do you handle ${trade(f.industry)}? How soon could someone help?` },
        { who: 'ai', text: reply },
      ],
    });
  }

  // 2) Voice call
  if (f.voiceEnabled) {
    out.push({
      title: 'The assistant answers a missed call',
      channel: 'voice',
      turns: [
        { who: 'note', text: "The customer calls, you can't pick up, so the call rolls to your assistant." },
        { who: 'ai', text: voiceOpener(name) },
        { who: 'customer', text: `Hi — I need help with ${trade(f.industry)}. Is someone available?` },
        { who: 'ai', text: `I can get that started for you. ${hoursLine}Can I grab your name and the best number for the team to reach you? I'll make sure they follow up.` },
      ],
    });
  }

  // 3) Emergency escalation (only if they told us what an emergency is)
  if (f.emergencyNotify && f.emergencyNotify.trim()) {
    const viaVoice = f.voiceEnabled;
    out.push({
      title: 'An urgent call gets flagged fast',
      channel: viaVoice ? 'voice' : 'text',
      turns: [
        { who: 'note', text: 'A caller says it’s urgent.' },
        { who: 'customer', text: "It's an emergency — I really need someone right now." },
        { who: 'ai', text: "That sounds urgent — I'm flagging this to the team right now so they can reach you as fast as possible. Can I get your name and address?" },
        { who: 'note', text: `→ We instantly notify: ${f.emergencyNotify.trim()}` },
      ],
    });
  } else {
    // Fallback third sample so there are always ~3: capturing the lead.
    out.push({
      title: 'Every chat ends by capturing the lead',
      channel: f.smsEnabled ? 'text' : 'voice',
      turns: [
        { who: 'customer', text: "My name's Jordan and I'm at 214 Oak Street." },
        { who: 'ai', text: `Perfect, Jordan — got it. The team will reach out shortly to confirm. Thanks for reaching ${name}!` },
        { who: 'note', text: '→ Saved to your leads so nothing slips through.' },
      ],
    });
  }

  return out;
}

export const SAMPLE_EXPECTATIONS: string[] = [
  'The assistant only shares details you gave us — it never guesses prices or availability.',
  'For anything complex or urgent, it takes a message or points the customer to your team.',
  "When it's unsure, it says “I'll have the team confirm” rather than making something up.",
];
