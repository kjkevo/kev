import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';
import { scanWebsite } from '@/app/lib/website';

export const dynamic = 'force-dynamic';

// POST /api/admin/businesses/[id]/scan-website — fetch the client's website and
// distill it into a facts sheet the assistants use. Stores the result in the
// signup's onboardingDetails: `websiteSummary` on success, `websiteScanNote`
// with the reason on failure — so a scan that can't find the site is visible
// to the operator (here and in Preflight) instead of failing silently.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const biz = await prisma.businessConfig.findUnique({ where: { id } });
  if (!biz) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  if (biz.signupId == null) {
    return NextResponse.json({ error: 'This business has no signup/form on file to read a website from.' }, { status: 400 });
  }

  const signup = await prisma.trialSignup.findUnique({ where: { id: biz.signupId } });
  const details = ((signup?.onboardingDetails as Record<string, string> | null) || {});
  const website = (details.websiteUrl || '').trim();
  if (!website) {
    return NextResponse.json({ error: 'No website on file — the client did not provide one.' }, { status: 400 });
  }

  const { summary, error, chars } = await scanWebsite(website, biz.businessName);
  const when = new Date().toISOString();

  const next = { ...details };
  if (summary) {
    next.websiteSummary = summary;
    delete next.websiteScanNote;
  } else {
    // Record WHY it failed so the operator sees it and can fill facts by hand.
    next.websiteScanNote = `Could not scan ${website} on ${when}: ${error || 'no usable content'}`;
  }
  await prisma.trialSignup.update({ where: { id: biz.signupId }, data: { onboardingDetails: next } });

  if (!summary) {
    return NextResponse.json({ ok: false, scanned: false, website, error: error || 'No usable content found.' }, { status: 200 });
  }
  return NextResponse.json({ ok: true, scanned: true, website, chars, summary });
}
