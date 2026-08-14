import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { checkAdminAuth } from '@/app/lib/adminAuth';
import { getNumberInfo, isOnMessagingService } from '@/app/lib/twilio';
import { isValidVoice } from '@/app/lib/voices';

export const dynamic = 'force-dynamic';

type Status = 'pass' | 'warn' | 'fail' | 'skip';
interface Check { id: string; label: string; status: Status; detail: string }

// GET /api/admin/businesses/[id]/preflight — inspect a built business's live
// wiring and report green/red per item, so nothing slips through before launch.
// Checks the actual Twilio number config (webhooks, A2P) plus our own flags
// (voice picked, Text AI key, channels match what they signed up for).
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = checkAdminAuth(request);
  if (denied) return denied;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const biz = await prisma.businessConfig.findUnique({ where: { id } });
  if (!biz) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

  const signup = biz.signupId != null
    ? await prisma.trialSignup.findUnique({ where: { id: biz.signupId } })
    : null;
  const pref = signup?.servicePreference || null; // "voice" | "text" | "both"
  const details = ((signup?.onboardingDetails as Record<string, string> | null) || {});

  const checks: Check[] = [];
  const info = await getNumberInfo(biz.businessPhone);
  const twilioLive = info !== null || Boolean(process.env.TWILIO_ACCOUNT_SID && !process.env.TWILIO_ACCOUNT_SID.includes('PLACEHOLDER'));

  // 1) Number connected
  if (info) {
    checks.push({ id: 'number', label: 'Number connected', status: 'pass', detail: `${biz.businessPhone} is live in your Twilio account.` });
  } else if (twilioLive) {
    checks.push({ id: 'number', label: 'Number connected', status: 'fail', detail: `${biz.businessPhone} was not found in your Twilio account. Provision or re-check the number.` });
  } else {
    checks.push({ id: 'number', label: 'Number connected', status: 'skip', detail: 'Twilio is not configured in this environment, so live wiring cannot be checked here.' });
  }

  // 2) SMS webhook (only meaningful if text is on)
  if (biz.smsEnabled) {
    if (!info) {
      checks.push({ id: 'sms-webhook', label: 'Text webhook', status: twilioLive ? 'fail' : 'skip', detail: twilioLive ? 'No number to check.' : 'Twilio not configured here.' });
    } else if (info.smsUrl.includes('/api/webhooks/twilio/sms-inbound')) {
      checks.push({ id: 'sms-webhook', label: 'Text webhook', status: 'pass', detail: 'Incoming texts route to Slimpse.' });
    } else {
      checks.push({ id: 'sms-webhook', label: 'Text webhook', status: 'fail', detail: `Number's "A message comes in" webhook is "${info.smsUrl || 'unset'}", not the Slimpse sms-inbound URL.` });
    }
  }

  // 3) A2P / Messaging Service (only meaningful if text is on)
  if (biz.smsEnabled) {
    const onMsg = info ? await isOnMessagingService(info.sid) : null;
    if (onMsg === true) {
      checks.push({ id: 'a2p', label: 'A2P messaging service', status: 'pass', detail: 'Number is attached to your approved campaign — texts won’t be carrier-filtered.' });
    } else if (onMsg === false) {
      checks.push({ id: 'a2p', label: 'A2P messaging service', status: 'fail', detail: 'Number is NOT on your Messaging Service. Attach it so texts inherit your A2P registration.' });
    } else {
      checks.push({ id: 'a2p', label: 'A2P messaging service', status: 'skip', detail: 'Set TWILIO_MESSAGING_SERVICE_SID (and Twilio creds) to verify A2P attachment.' });
    }
  }

  // 4) Voice routing
  if (biz.voiceEnabled) {
    if (!info) {
      checks.push({ id: 'voice-route', label: 'Voice routing (Vapi)', status: twilioLive ? 'fail' : 'skip', detail: twilioLive ? 'No number to check.' : 'Twilio not configured here.' });
    } else if (/vapi/i.test(info.voiceUrl)) {
      checks.push({ id: 'voice-route', label: 'Voice routing (Vapi)', status: 'pass', detail: 'Calls route to Vapi (number imported).' });
    } else {
      checks.push({ id: 'voice-route', label: 'Voice routing (Vapi)', status: 'warn', detail: `Voice is ON but the number's voice webhook is "${info.voiceUrl || 'unset'}" — import this number into Vapi so the AI answers.` });
    }
  } else if (biz.smsEnabled && info) {
    // Text-only still needs the voice webhook pointed at us so the missed call
    // fires the text-back.
    if (info.voiceUrl.includes('/api/webhooks/twilio/incoming-call')) {
      checks.push({ id: 'voice-route', label: 'Missed-call trigger', status: 'pass', detail: 'Calls hit Slimpse so a missed call sends the text-back.' });
    } else {
      checks.push({ id: 'voice-route', label: 'Missed-call trigger', status: 'warn', detail: `Number's voice webhook is "${info.voiceUrl || 'unset'}", not the Slimpse incoming-call URL. Text-back may not fire.` });
    }
  }

  // 5) Voice picked (only if voice on)
  if (biz.voiceEnabled) {
    if (isValidVoice(biz.voice)) {
      checks.push({ id: 'voice-pick', label: 'Voice selected', status: 'pass', detail: 'A specific ElevenLabs voice is set.' });
    } else {
      checks.push({ id: 'voice-pick', label: 'Voice selected', status: 'warn', detail: 'No voice picked — the AI will use a default. Set one in "Set up text & voice".' });
    }
  }

  // 6) Text AI
  if (biz.aiTextEnabled) {
    if (process.env.ANTHROPIC_API_KEY) {
      checks.push({ id: 'text-ai', label: 'Text AI', status: 'pass', detail: 'AI text replies on and ANTHROPIC_API_KEY is set.' });
    } else {
      checks.push({ id: 'text-ai', label: 'Text AI', status: 'fail', detail: 'AI text replies are ON but ANTHROPIC_API_KEY is missing — inbound texts won’t get AI answers.' });
    }
  }

  // 7) Channels match what they signed up for
  if (pref) {
    const wantSms = pref === 'text' || pref === 'both';
    const wantVoice = pref === 'voice' || pref === 'both';
    const ok = wantSms === biz.smsEnabled && wantVoice === biz.voiceEnabled;
    const label = (s: boolean, v: boolean) => (s && v ? 'Voice + Text' : v ? 'Voice' : s ? 'Text' : 'nothing');
    checks.push({
      id: 'channels',
      label: 'Channels match signup',
      status: ok ? 'pass' : 'warn',
      detail: ok
        ? `Signed up for ${label(wantSms, wantVoice)} and that’s what’s on.`
        : `Signed up for ${label(wantSms, wantVoice)} but configured as ${label(biz.smsEnabled, biz.voiceEnabled)}.`,
    });
  }

  // Website scan status (only if they gave a website).
  const website = (details.websiteUrl || '').trim();
  if (website) {
    if (details.websiteSummary && details.websiteSummary.trim()) {
      checks.push({ id: 'website', label: 'Website scanned', status: 'pass', detail: 'The assistants are grounded in facts pulled from their website.' });
    } else if (details.websiteScanNote) {
      checks.push({ id: 'website', label: 'Website scan', status: 'warn', detail: details.websiteScanNote });
    } else {
      checks.push({ id: 'website', label: 'Website scan', status: 'warn', detail: `Website on file (${website}) but not scanned yet — use “Scan website”.` });
    }
  }

  const summary = {
    pass: checks.filter((c) => c.status === 'pass').length,
    warn: checks.filter((c) => c.status === 'warn').length,
    fail: checks.filter((c) => c.status === 'fail').length,
    skip: checks.filter((c) => c.status === 'skip').length,
  };

  return NextResponse.json({ businessName: biz.businessName, businessPhone: biz.businessPhone, summary, checks });
}
