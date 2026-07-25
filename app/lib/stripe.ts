import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

// Live only when a real key is present. Like the Twilio/email wrappers, billing
// degrades gracefully when unconfigured so the rest of the app keeps working.
export const stripeConfigured = Boolean(secretKey && !secretKey.includes('PLACEHOLDER'));

export const stripe = stripeConfigured
  ? new Stripe(secretKey as string, { apiVersion: '2024-06-20' })
  : null;

// Price IDs are created once in the Stripe dashboard (Products) and set in env.
export const PRICES: Record<string, string | undefined> = {
  monthly: process.env.STRIPE_PRICE_MONTHLY,
  annual: process.env.STRIPE_PRICE_ANNUAL,
};

export function priceIdForPlan(plan: string): string | undefined {
  return PRICES[plan] ?? PRICES.monthly;
}

// Create a Checkout Session to convert a trial into a paid subscription. Card is
// collected here (not at signup) — this is the "Add payment to continue" step.
export async function createCheckoutSession(opts: {
  token: string;
  email: string;
  businessName: string;
  plan: string;
  customerId?: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string | null; error?: string }> {
  if (!stripe) return { url: null, error: 'Billing is not configured yet.' };
  const price = priceIdForPlan(opts.plan);
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
