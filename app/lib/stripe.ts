import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

// Live only when a real key is present. Like the Twilio/email wrappers, billing
// degrades gracefully when unconfigured so the rest of the app keeps working.
export const stripeConfigured = Boolean(secretKey && !secretKey.includes('PLACEHOLDER'));

export const stripe = stripeConfigured
  ? new Stripe(secretKey as string, { apiVersion: '2024-06-20' })
  : null;

// Price IDs are created once in the Stripe dashboard (Products) and set in env.
// Tiered by channel: "single" = Voice OR Text ($59.99/mo); "both" = Voice + Text
// ($100/mo). The tier is derived from the client's chosen service.
export const PRICES: Record<string, string | undefined> = {
  single: process.env.STRIPE_PRICE_SINGLE,
  both: process.env.STRIPE_PRICE_BOTH,
};

export function tierForService(service?: string | null): 'single' | 'both' {
  return service === 'both' ? 'both' : 'single';
}

export function priceIdForTier(tier: string): string | undefined {
  return PRICES[tier] ?? PRICES.single;
}

// Create a Checkout Session to convert a trial into a paid subscription. Card is
// collected here (not at signup) — this is the "Add payment to continue" step.
export async function createCheckoutSession(opts: {
  token: string;
  email: string;
  businessName: string;
  tier: string; // "single" | "both"
  customerId?: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string | null; error?: string }> {
  if (!stripe) return { url: null, error: 'Billing is not configured yet.' };
  const price = priceIdForTier(opts.tier);
  if (!price) return { url: null, error: 'No Stripe price is configured.' };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      // Tie the session back to our signup so the webhook can update the right row.
      client_reference_id: opts.token,
      ...(opts.customerId ? { customer: opts.customerId } : { customer_email: opts.email }),
      subscription_data: { metadata: { token: opts.token, businessName: opts.businessName } },
      metadata: { token: opts.token },
      allow_promotion_codes: true,
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
    });
    return { url: session.url };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return { url: null, error: error instanceof Error ? error.message : String(error) };
  }
}

// Billing portal: where a paying client updates their card, sees invoices, or
// cancels — Stripe hosts the whole dunning/cancellation flow.
// Immediately cancel a subscription (used when the operator ends a client).
export async function cancelSubscription(subscriptionId: string): Promise<{ ok: boolean; error?: string }> {
  if (!stripe) return { ok: false, error: 'Billing is not configured.' };
  try {
    await stripe.subscriptions.cancel(subscriptionId);
    return { ok: true };
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function createPortalSession(opts: {
  customerId: string;
  returnUrl: string;
}): Promise<{ url: string | null; error?: string }> {
  if (!stripe) return { url: null, error: 'Billing is not configured yet.' };
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: opts.customerId,
      return_url: opts.returnUrl,
    });
    return { url: session.url };
  } catch (error) {
    console.error('Error creating portal session:', error);
    return { url: null, error: error instanceof Error ? error.message : String(error) };
  }
}
