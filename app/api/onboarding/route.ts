import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { normalizePhone } from '@/app/lib/phone';
import { randomUUID } from 'crypto';
import { sendTrialSignupAlert, sendCheckYourEmailText, sendSignupWelcomeEmail } from '@/app/lib/notifications';

export const dynamic = 'force-dynamic';

// This endpoint is called from the public landing page (our /start form and the
// Hostinger CTA), so allow cross-origin POSTs from the browser.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// Accept either JSON (our /start fetch) or a classic HTML form post (Hostinger
// embed), so the same endpoint works from both.
async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    return (await request.json()) as Record<string, unknown>;
  }
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

// POST /api/onboarding — public trial signup from the landing page / demo.
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await readBody(request);
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: corsHeaders });
  }

  const businessName = String(body.businessName ?? '').trim();
  const email = String(body.email ?? '').trim();
  const trade = String(body.trade ?? '').trim();
  const mobile = normalizePhone(String(body.mobile ?? ''));

  if (!businessName) return NextResponse.json({ error: 'Please enter your business name.' }, { status: 400, headers: corsHeaders });
  if (!mobile) return NextResponse.json({ error: 'Please enter a valid US mobile number.' }, { status: 400, headers: corsHeaders });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400, headers: corsHeaders });
  }

  const token = randomUUID();
  try {
    await prisma.trialSignup.create({
      data: { businessName, mobile, email, trade: trade || null, token },
    });
  } catch (error) {
    console.error('Error creating trial signup:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500, headers: corsHeaders });
  }

  // Build the status/cancel link from this request's own origin.
  const statusUrl = `${new URL(request.url).origin}/welcome?t=${token}`;

  // All best-effort — a signup should never fail because email or SMS is down.
  sendTrialSignupAlert({ businessName, mobile, email, trade }).catch(console.error);
  // Text the prospect to go check their email for the setup form, then email it.
  sendCheckYourEmailText(mobile, businessName).catch(console.error);
  sendSignupWelcomeEmail({ businessName, email }, statusUrl).catch(console.error);

  return NextResponse.json({ success: true }, { headers: corsHeaders });
}
