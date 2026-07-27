import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';
import { normalizePhone } from '@/app/lib/phone';
import { normalizeVoiceMenuForStore } from '@/app/lib/voiceMenu';

// PATCH /api/admin/businesses/:id — update a business
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (body.businessName !== undefined) data.businessName = String(body.businessName).trim();
  if (body.ownerEmail !== undefined) data.ownerEmail = String(body.ownerEmail).trim();
  if (body.missedCallMessage !== undefined) data.missedCallMessage = String(body.missedCallMessage);
  if (body.leadSubmissionMsg !== undefined) data.leadSubmissionMsg = String(body.leadSubmissionMsg);
  if (body.voiceGreeting !== undefined) data.voiceGreeting = String(body.voiceGreeting);
  if (body.active !== undefined) data.active = Boolean(body.active);
  // Extend the trial by N days from the later of now / current end date.
  if (body.extendDays !== undefined) {
    const days = Number(body.extendDays);
    if (Number.isFinite(days) && days > 0) {
      const current = await prisma.businessConfig.findUnique({ where: { id }, select: { trialEndsAt: true } });
      const base = current?.trialEndsAt && current.trialEndsAt.getTime() > Date.now() ? current.trialEndsAt.getTime() : Date.now();
      data.trialEndsAt = new Date(base + days * 24 * 60 * 60 * 1000);
      // Re-open the reminder gate and reactivate when extending.
      data.trialReminderStage = 0;
      data.active = true;
    }
  }
  if (body.smsEnabled !== undefined) data.smsEnabled = Boolean(body.smsEnabled);
  if (body.voiceEnabled !== undefined) data.voiceEnabled = Boolean(body.voiceEnabled);
  if (body.recordVoicemail !== undefined) data.recordVoicemail = Boolean(body.recordVoicemail);
  if (body.voiceMenu !== undefined) {
    data.voiceMenu = normalizeVoiceMenuForStore(body.voiceMenu) ?? Prisma.JsonNull;
  }

  if (body.businessPhone !== undefined) {
    const normalized = normalizePhone(String(body.businessPhone));
    if (!normalized) {
      return NextResponse.json({ error: 'businessPhone must be a valid US phone number' }, { status: 400 });
    }
    data.businessPhone = normalized;
  }
  if (body.ownerPhone !== undefined) {
    const normalized = normalizePhone(String(body.ownerPhone));
    if (!normalized) {
      return NextResponse.json({ error: 'ownerPhone must be a valid US phone number' }, { status: 400 });
    }
    data.ownerPhone = normalized;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const business = await prisma.businessConfig.update({ where: { id }, data });
    return NextResponse.json({ business });
  } catch (error: unknown) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : undefined;
    if (code === 'P2025') {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    if (code === 'P2002') {
      return NextResponse.json({ error: 'A business with that phone number already exists' }, { status: 409 });
    }
    console.error('Error updating business:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/businesses/:id — remove a business
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    await prisma.businessConfig.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : undefined;
    if (code === 'P2025') {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    console.error('Error deleting business:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
