/**
 * Normalize a US phone number to E.164 (+1XXXXXXXXXX) so numbers entered as
 * "(847) 613-1968", "847-613-1968", or "8476131968" all match the format
 * Twilio sends on webhooks. Returns null if the input can't be normalized.
 */
export function normalizePhone(input: string): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  // Already E.164 with a plus — keep digits after the plus.
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    return digits.length >= 10 ? `+${digits}` : null;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}
