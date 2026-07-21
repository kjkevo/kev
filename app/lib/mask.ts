/**
 * Partially masks a phone number for public display, keeping the country/area
 * code and the last two digits so activity is recognizable without exposing a
 * full customer number on a public page.
 *
 *   "+13125550123" -> "+1 (312) •••-••23"
 */
export function maskPhone(phone: string): string {
  if (!phone) return "Unknown";
  const digits = phone.replace(/\D/g, "");
  // US format: 1 + area(3) + prefix(3) + line(4)
  if (digits.length === 11 && digits.startsWith("1")) {
    const area = digits.slice(1, 4);
    const last2 = digits.slice(-2);
    return `+1 (${area}) •••-••${last2}`;
  }
  if (digits.length === 10) {
    const area = digits.slice(0, 3);
    const last2 = digits.slice(-2);
    return `(${area}) •••-••${last2}`;
  }
  // Fallback: show last two digits only
  const last2 = digits.slice(-2);
  return `•••••${last2}`;
}
