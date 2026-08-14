// Lightweight, deterministic emergency detection for inbound messages and call
// summaries. Zero extra API cost/latency: we match the customer's words against
// a base list of genuinely-urgent terms plus any domain terms the business named
// in their own "what counts as an emergency" answer. Kept intentionally tight so
// it flags real emergencies without crying wolf on every routine question.

// Multi-word phrases are matched as substrings; single words as whole words.
const BASE_TERMS: string[] = [
  'emergency', 'urgent', 'asap', 'right now', 'right away', 'immediately',
  'flooding', 'flood', 'leak', 'leaking', 'burst', 'overflowing',
  'no heat', 'no water', 'no power', 'power outage', 'outage',
  'gas', 'smoke', 'fire', 'sparks', 'sparking',
  'injured', 'bleeding', 'trapped', 'danger', 'dangerous', 'locked out',
];

// Words to ignore when pulling extra triggers from the business's description —
// these are the "who/how to notify" instructions, not the trigger itself.
const IGNORE = new Set([
  'text', 'call', 'calls', 'notify', 'email', 'send', 'within', 'minute', 'minutes',
  'second', 'seconds', 'right', 'away', 'someone', 'number', 'phone', 'please',
  'immediately', 'asap', 'them', 'they', 'that', 'this', 'with', 'your', 'anyone',
  'saying', 'about', 'when', 'then', 'from', 'have', 'need', 'wants', 'want',
]);

// Does this message look like an emergency for this business? `description` is
// the business's own emergencyNotify answer (may be empty).
export function detectEmergency(message: string, description?: string | null): boolean {
  const hay = ` ${(message || '').toLowerCase()} `;
  if (!hay.trim()) return false;

  const terms = new Set(BASE_TERMS);
  if (description) {
    for (const w of description.toLowerCase().split(/[^a-z]+/)) {
      if (w.length >= 4 && !IGNORE.has(w)) terms.add(w);
    }
  }

  for (const t of terms) {
    if (t.includes(' ')) {
      if (hay.includes(` ${t} `) || hay.includes(`${t} `) || hay.includes(` ${t}`)) return true;
    } else if (new RegExp(`\\b${t}\\b`).test(hay)) {
      return true;
    }
  }
  return false;
}
