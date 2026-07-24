// Keyword voice menu: a caller says (or keys) a service, Twilio matches it to
// one of the business's configured options, then speaks a reply and sends a
// service-specific text-back.

export interface VoiceMenuOption {
  label: string;        // short name, e.g. "DJ"
  keywords: string[];   // spoken phrases that map here, e.g. ["dj","music"]
  reply: string;        // what Twilio speaks back
  sms: string;          // service-specific text-back message
}

export interface VoiceMenu {
  enabled: boolean;
  prompt: string;                 // the spoken question
  options: VoiceMenuOption[];
  fallbackReply?: string;         // spoken when nothing matches
  fallbackSms?: string;           // texted when nothing matches
}

// Parse the JSON blob stored on BusinessConfig.voiceMenu into a typed menu.
// Returns null when absent, malformed, disabled, or has no usable options.
export function parseVoiceMenu(raw: unknown): VoiceMenu | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (m.enabled !== true) return null;

  const options = Array.isArray(m.options)
    ? m.options
        .map((o) => {
          const opt = (o ?? {}) as Record<string, unknown>;
          return {
            label: String(opt.label ?? '').trim(),
            keywords: Array.isArray(opt.keywords)
              ? opt.keywords.map((k) => String(k).trim().toLowerCase()).filter(Boolean)
              : [],
            reply: String(opt.reply ?? '').trim(),
            sms: String(opt.sms ?? '').trim(),
          };
        })
        .filter((o) => o.label && (o.keywords.length > 0 || o.sms || o.reply))
    : [];

  if (options.length === 0) return null;

  return {
    enabled: true,
    prompt: String(m.prompt ?? '').trim() || 'What are you calling about?',
    options,
    fallbackReply: m.fallbackReply ? String(m.fallbackReply).trim() : undefined,
    fallbackSms: m.fallbackSms ? String(m.fallbackSms).trim() : undefined,
  };
}

// Clean an incoming menu (from the admin form) into a plain object safe to
// persist as JSON. Keywords may arrive as an array or a comma-separated string.
// Returns null for non-objects. Keeps disabled menus so the toggle persists.
export function normalizeVoiceMenuForStore(raw: unknown): VoiceMenu | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;

  const options: VoiceMenuOption[] = Array.isArray(m.options)
    ? m.options.map((o) => {
        const opt = (o ?? {}) as Record<string, unknown>;
        const keywords = Array.isArray(opt.keywords)
          ? opt.keywords.map((k) => String(k).trim()).filter(Boolean)
          : String(opt.keywords ?? '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
        return {
          label: String(opt.label ?? '').trim(),
          keywords,
          reply: String(opt.reply ?? '').trim(),
          sms: String(opt.sms ?? '').trim(),
        };
      }).filter((o) => o.label || o.sms || o.reply || o.keywords.length > 0)
    : [];

  return {
    enabled: Boolean(m.enabled),
    prompt: String(m.prompt ?? '').trim(),
    options,
    fallbackReply: String(m.fallbackReply ?? '').trim(),
    fallbackSms: String(m.fallbackSms ?? '').trim(),
  };
}

// Speech hints improve recognition — feed Twilio every keyword + label.
export function voiceMenuHints(menu: VoiceMenu): string {
  const words = new Set<string>();
  for (const o of menu.options) {
    if (o.label) words.add(o.label);
    for (const k of o.keywords) words.add(k);
  }
  return Array.from(words).join(', ');
}

// Match a caller's response to a menu option.
//  - DTMF digit "1" maps to the first option, "2" to the second, etc.
//  - Otherwise, case-insensitive: an option matches if any of its keywords (or
//    its label) appears as a whole word / substring of what the caller said.
// Returns the matched option or null.
export function matchVoiceMenu(
  menu: VoiceMenu,
  speech: string | undefined,
  digits: string | undefined,
): VoiceMenuOption | null {
  if (digits) {
    const idx = parseInt(digits, 10) - 1;
    if (idx >= 0 && idx < menu.options.length) return menu.options[idx];
  }

  const said = (speech ?? '').toLowerCase();
  if (!said.trim()) return null;

  for (const opt of menu.options) {
    const needles = [opt.label.toLowerCase(), ...opt.keywords].filter(Boolean);
    if (needles.some((n) => said.includes(n))) return opt;
  }
  return null;
}
