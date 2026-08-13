// Voices offered to clients who pick Voice/Both. These are ElevenLabs voices —
// the same engine our Voice AI (Vapi) speaks in — so what a client previews on
// the setup form is exactly what their callers will hear on a live AI call.
// `id` is the ElevenLabs voice ID (passed straight to Vapi as an 11labs voice);
// `file` is a short in-browser preview clip in public/voices/.
// Kept in its own client-safe module (no server imports) so the /welcome form
// and the server routes can share it.
export interface VoiceOption {
  id: string;
  label: string;
  file: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel, warm female', file: '/voices/rachel.mp3' },
  { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam, deep male', file: '/voices/adam.mp3' },
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Bella, soft female', file: '/voices/bella.mp3' },
  { id: 'ErXwobaYiN019PkySvjV', label: 'Antoni, friendly male', file: '/voices/antoni.mp3' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', label: 'Elli, bright female', file: '/voices/elli.mp3' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', label: 'Josh, confident male', file: '/voices/josh.mp3' },
];

export const DEFAULT_VOICE = VOICE_OPTIONS[0].id;

export const isValidVoice = (v: unknown): v is string =>
  typeof v === 'string' && VOICE_OPTIONS.some((o) => o.id === v);
