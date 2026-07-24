import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { normalizePhone } from '@/app/lib/phone';
import { sendTrialSignupAlert } from '@/app/lib/notifications';

export const dynamic = 'force-dynamic';

// POST /api/onboarding — public trial signup from the landing page / demo.
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const businessName = String(body.businessName ?? '').trim();
  const email = String(body.email ?? '').trim();
  const trade = String(body.trade ?? '').trim();
  const mobile = normalizePhone(String(body.mobile ?? ''));

  if (!businessName) return NextResponse.json({ error: 'Please enter your business name.' }, { status: 400 });
  if (!mobile) return NextResponse.json({ error: 'Please enter a valid US mobile number.' }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  try {
    await prisma.trialSignup.create({
      data: { businessName, mobile, email, trade: trade || null },
    });
  } catch (error) {
    console.error('Error creating trial signup:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }

  // Notify the operator (best-effort — don't fail the signup if email is down).
  sendTrialSignupAlert({ businessName, mobile, email, trade }).catch(console.error);

  return NextResponse.json({ success: true });
}
