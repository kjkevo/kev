// Curated Twilio <Say> voices offered to clients who pick Voice/Both. Every id
// here is a valid Amazon Polly *Neural* voice that Twilio supports, so whatever
// a client previews is exactly what their callers will hear. Kept in its own
// client-safe module (no server imports) so both the /welcome form and the
// server route can share it.
export interface VoiceOption {
  id: string;
  label: string;
  // Public path to a short pre-recorded demo clip of this exact Polly voice,
  // played in-browser on the /welcome form (generate once via the AWS Polly
  // console, Neural engine, and drop the mp3 in public/voices/).
  file: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: 'Polly.Joanna-Neural', label: 'Joanna, warm female', file: '/voices/joanna.mp3' },
  { id: 'Polly.Matthew-Neural', label: 'Matthew, friendly male', file: '/voices/matthew.mp3' },
  { id: 'Polly.Danielle-Neural', label: 'Danielle, bright female', file: '/voices/danielle.mp3' },
  { id: 'Polly.Stephen-Neural', label: 'Stephen, confident male', file: '/voices/stephen.mp3' },
  { id: 'Polly.Ruth-Neural', label: 'Ruth, calm female', file: '/voices/ruth.mp3' },
  { id: 'Polly.Gregory-Neural', label: 'Gregory, deep male', file: '/voices/gregory.mp3' },
];

export const DEFAULT_VOICE = VOICE_OPTIONS[0].id;

export const isValidVoice = (v: unknown): v is string =>
  typeof v === 'string' && VOICE_OPTIONS.some((o) => o.id === v);
