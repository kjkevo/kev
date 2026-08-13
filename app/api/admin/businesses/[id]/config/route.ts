import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';
import { isValidVoice } from '@/app/lib/voices';

export const dynamic = 'force-dynamic';

// POST /api/admin/businesses/[id]/config — operator setup editor. Update the
// text-back message, lead confirmation, channel toggles, voice greeting, and
// the Twilio voice for a built business before the client reviews it.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const business = await prisma.businessConfig.findUnique({ where: { id } });
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));

  // Build a partial update from only the fields provided, validating types.
  const data: Record<string, unknown> = {};
  if (typeof body.missedCallMessage === 'string') data.missedCallMessage = body.missedCallMessage.trim();
  if (typeof body.leadSubmissionMsg === 'string') data.leadSubmissionMsg = body.leadSubmissionMsg.trim();
  if (typeof body.voiceGreeting === 'string') data.voiceGreeting = body.voiceGreeting.trim();
  if (typeof body.smsEnabled === 'boolean') data.smsEnabled = body.smsEnabled;
  if (typeof body.voiceEnabled === 'boolean') data.voiceEnabled = body.voiceEnabled;
  if (typeof body.aiTextEnabled === 'boolean') data.aiTextEnabled = body.aiTextEnabled;
  if (body.voice === null || body.voice === '') data.voice = null;
  else if (isValidVoice(body.voice)) data.voice = body.voice;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const updated = await prisma.businessConfig.update({ where: { id }, data });
  return NextResponse.json({ success: true, business: { id: updated.id } });
}
