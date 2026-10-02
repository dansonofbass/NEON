# Gameplay music

Place your music here with this exact lowercase filename:

`gameplay.mp3`

The game loops it at 30% volume during the eight-second city intro and gameplay. Sound OFF mutes both
music and effects. Pause/Escape, focus loss, death and Main Menu stop playback;
Resume continues the track, while Restart starts it from the beginning.
The supplied gameplay.mp3 is present. Missing or blocked audio does not stop the game.

MP3 is recommended for browser compatibility and small downloads. To use an
OGG or WAV instead, change MUSIC_URL in game/music.ts to its actual filename.
Do not simply rename the extension. MIDI needs a synthesizer and is not
supported by this player: render/export your MIDI as MP3 first.

Files in public are included automatically on the next build/deployment.
No external upload service is needed.

## Long tracks and download size

Recommended: a 3-5 minute loop exported as stereo MP3 at 128 kbps, approximately
2.9-4.8 MB. For longer tracks, 96-128 kbps is a useful starting range; audition the
result before choosing. At 128 kbps, 10 minutes is about 9.6 MB and 30 minutes is
about 28.8 MB (decimal MB, excluding artwork/tags). Avoid uncompressed WAV and
large embedded cover artwork when download size matters.

The remote track is attached only after the city intro starts with sound enabled.
A tiny inline silent sample handles the initial audio unlock without downloading
the track while the engine loads. Native audio buffers progressively; the game
never fetches the complete file into a Blob or decodes it into a Web Audio buffer.
Browser buffering is implementation-dependent: this is not adaptive streaming
and does not guarantee a fixed download budget or uninterrupted slow-network audio.

Vercel audio URLs have a one-hour browser cache policy. When replacing a track,
use a new filename and update MUSIC_URL to avoid the old version for that hour.
The local static preview supports byte-range/HEAD requests and streams files
without holding the whole track in server memory. Vercel serves the deployed
files directly; this preview server is not deployed.
