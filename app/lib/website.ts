import { summarizeWebsite } from './ai';

// Fetch a business's website and distill it into a compact facts sheet for the
// phone/text assistants. Best-effort: returns { summary: null, error } on any
// problem so callers can degrade gracefully. Server-only (uses fetch + the AI
// key). We fetch the homepage plus a couple of likely info pages, strip the HTML
// to text, and hand it to Claude to summarize.

// Turn whatever the user typed into a fetchable https URL.
export function normalizeUrl(input: string): string | null {
  const raw = (input || '').trim();
  if (!raw) return null;
  let url = raw;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

// Strip HTML down to readable text: drop scripts/styles/head noise, turn tags
// into spaces, decode a few common entities, collapse whitespace.
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchText(url: string, timeoutMs = 6000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'SlimpseBot/1.0 (+business setup assistant)', Accept: 'text/html' },
    });
    if (!res.ok) return '';
    const ctype = res.headers.get('content-type') || '';
    if (!ctype.includes('html') && !ctype.includes('text')) return '';
    const html = (await res.text()).slice(0, 400_000);
    return htmlToText(html);
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

// Scan a business website: homepage + a few common info pages, then summarize.
export async function scanWebsite(
  input: string,
  businessName: string,
): Promise<{ summary: string | null; error?: string; chars?: number }> {
  const base = normalizeUrl(input);
  if (!base) return { summary: null, error: 'That website address does not look valid.' };

  const origin = new URL(base).origin;
  // Homepage first (usually enough), then a couple likely info pages. Stop as
  // soon as we have plenty, to stay within the serverless time budget.
  const candidates = [base, `${origin}/services`, `${origin}/about`];

  const seen = new Set<string>();
  let combined = '';
  for (const url of candidates) {
    if (seen.has(url)) continue;
    seen.add(url);
    const text = await fetchText(url);
    if (text) combined += `\n\n[${url}]\n${text}`;
    if (combined.length > 9000) break; // homepage alone is usually plenty
  }

  const trimmed = combined.trim();
  if (!trimmed) return { summary: null, error: 'Could not read anything from that website.' };

  const { summary, error } = await summarizeWebsite(businessName, trimmed);
  return { summary, error, chars: trimmed.length };
}
