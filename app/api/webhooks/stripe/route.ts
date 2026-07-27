import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { prisma } from '@/app/lib/db';
import { stripe, PRICES } from '@/app/lib/stripe';
import { sendBillingAlert } from '@/app/lib/notifications';

export const dynamic = 'force-dynamic';

// Stripe posts subscription-lifecycle events here. This is the source of truth
// for who's paying — never trust the browser redirect alone.
export async function POST(request: NextRequest) {
  if (!stripe) return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = request.headers.get('stripe-signature') || '';
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not set');
    event = stripe.webhooks.constructEvent(payload, sig, secret);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const planFromPrice = (priceId?: string | null): string | undefined => {
    if (!priceId) return undefined;
    if (priceId === PRICES.both) return 'both';
    if (priceId === PRICES.single) return 'single';
    return undefined;
  };

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const token = s.client_reference_id || (s.metadata?.token as string | undefined);
        if (token) {
          await prisma.trialSignup.updateMany({
            where: { token },
            data: {
              stripeCustomerId: (s.customer as string) ?? undefined,
              stripeSubscriptionId: (s.subscription as string) ?? undefined,
              subscriptionStatus: 'active',
            },
          });
          const signup = await prisma.trialSignup.findUnique({ where: { token } });
          // Turn their live service back on immediately (in case the trial had
          // already lapsed and auto-disabled them).
          if (signup) {
            await prisma.businessConfig.updateMany({ where: { signupId: signup.id }, data: { active: true } });
          }
          await sendBillingAlert(
            `💳 New paid customer: ${signup?.businessName ?? token}`,
            `<p><strong>${signup?.businessName ?? ''}</strong> (${signup?.email ?? ''}) just converted to paid. 🎉</p>`,
          );
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        const token = sub.metadata?.token as string | undefined;
        const priceId = sub.items.data[0]?.price?.id;
        const data = {
          subscriptionStatus: sub.status,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          ...(planFromPrice(priceId) ? { plan: planFromPrice(priceId) } : {}),
        };
        if (token) await prisma.trialSignup.updateMany({ where: { token }, data });
        else await prisma.trialSignup.updateMany({ where: { stripeCustomerId: sub.customer as string }, data });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.trialSignup.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { subscriptionStatus: 'canceled' },
        });
        // Pause their live service on cancellation.
        const canceled = await prisma.trialSignup.findFirst({ where: { stripeSubscriptionId: sub.id }, select: { id: true } });
        if (canceled) {
          await prisma.businessConfig.updateMany({ where: { signupId: canceled.id }, data: { active: false } });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        const customerId = inv.customer as string;
        await prisma.trialSignup.updateMany({
          where: { stripeCustomerId: customerId },
          data: { subscriptionStatus: 'past_due' },
        });
        const signup = await prisma.trialSignup.findFirst({ where: { stripeCustomerId: customerId } });
        await sendBillingAlert(
          `⚠️ Payment failed: ${signup?.businessName ?? customerId}`,
          `<p>A payment failed for <strong>${signup?.businessName ?? ''}</strong> (${signup?.email ?? ''}).
           Stripe will retry automatically (dunning). No action needed unless it stays past due.</p>`,
        );
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error(`Error handling Stripe event ${event.type}:`, error);
    // Return 200 so Stripe doesn't hammer retries for a non-signature error we've logged.
  }

  return NextResponse.json({ received: true });
}
