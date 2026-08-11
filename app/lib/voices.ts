// Curated Twilio <Say> voices offered to clients who pick Voice/Both. Every id
// here is a valid Amazon Polly *Neural* voice that Twilio supports, so whatever
// a client previews is exactly what their callers will hear. Kept in its own
// client-safe module (no server imports) so both the /welcome form and the
// server route can share it.
export interface VoiceOption {
  id: string;
  label: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: 'Polly.Joanna-Neural', label: 'Joanna — warm female' },
  { id: 'Polly.Matthew-Neural', label: 'Matthew — friendly male' },
  { id: 'Polly.Danielle-Neural', label: 'Danielle — bright female' },
  { id: 'Polly.Stephen-Neural', label: 'Stephen — confident male' },
  { id: 'Polly.Ruth-Neural', label: 'Ruth — calm female' },
  { id: 'Polly.Gregory-Neural', label: 'Gregory — deep male' },
];

export const DEFAULT_VOICE = VOICE_OPTIONS[0].id;

export const isValidVoice = (v: unknown): v is string =>
  typeof v === 'string' && VOICE_OPTIONS.some((o) => o.id === v);
