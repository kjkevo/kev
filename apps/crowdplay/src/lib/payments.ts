/**
 * Which payment path is live. "practice" until Square keys are set: the pay
 * screen still works end to end and purchases are recorded as TEST.
 */
export type PaymentMode = "practice" | "sandbox" | "production";

export function squareMode(): PaymentMode {
  const appId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID;
  const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;
  const hasServerKey = typeof window !== "undefined" || !!process.env.SQUARE_ACCESS_TOKEN;
  if (!appId || !locationId || !hasServerKey) return "practice";
  return process.env.NEXT_PUBLIC_SQUARE_ENV === "production" ? "production" : "sandbox";
}
