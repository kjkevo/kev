# Voice preview clips (ElevenLabs)

The /welcome setup form plays a short in-browser demo of each voice. These are
**ElevenLabs** voices — the same engine our Voice AI (Vapi) speaks in — so the
preview matches what callers actually hear. Drop the MP3s here with these exact
names:

- `rachel.mp3`  (Rachel — warm female)
- `adam.mp3`    (Adam — deep male)
- `bella.mp3`   (Bella — soft female)
- `antoni.mp3`  (Antoni — friendly male)
- `elli.mp3`    (Elli — bright female)
- `josh.mp3`    (Josh — confident male)

## How to generate them (free, ~5 min)

1. Go to **elevenlabs.io** → sign in → **Voices** (or Speech Synthesis).
2. Find each voice above in the Voice Library / Premade voices.
3. Paste this line (same for every voice):

   > Hi, thanks for calling! We're not available right now, but we'll text you right back.

4. Generate → **Download** the MP3 → rename to match the list above → put it here.

If a voice name isn't in your library, pick a close substitute and send me its
**Voice ID** so I map it in `app/lib/voices.ts`. Until a clip is added, that
voice's Preview button just shows a "not available yet" note.
