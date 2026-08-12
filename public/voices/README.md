# Voice preview clips

The /welcome setup form plays a short in-browser demo of each Twilio call voice.
Drop the MP3 files here with these exact names:

- `joanna.mp3`   (Polly.Joanna-Neural)
- `matthew.mp3`  (Polly.Matthew-Neural)
- `danielle.mp3` (Polly.Danielle-Neural)
- `stephen.mp3`  (Polly.Stephen-Neural)
- `ruth.mp3`     (Polly.Ruth-Neural)
- `gregory.mp3`  (Polly.Gregory-Neural)

## How to generate them (free, ~5 min)

1. AWS Console → **Amazon Polly** → **Text-to-Speech**.
2. Engine: **Neural**. Language: **English (US)**.
3. Paste this line (same for every voice):

   > Hi, thanks for calling! We're not available right now, but we'll text you right back.

4. Pick the voice (Joanna, Matthew, Danielle, Stephen, Ruth, Gregory), click
   **Listen** to confirm, then **Download MP3**.
5. Rename the file to match the list above and place it in this folder.

These are the exact Polly Neural voices Twilio uses, so the preview matches
what callers actually hear. Until a clip is added, the form falls back to the
live "Call me a sample" phone call.
