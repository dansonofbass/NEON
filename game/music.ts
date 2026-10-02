// Served directly by the static export. Add your own track in public/audio/.
export const MUSIC_URL = '/audio/gameplay.mp3';
// Ten milliseconds of local silence unlocks audio without competing with game assets.
const SILENCE = 'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

export class GameMusic {
  private audio: HTMLAudioElement;
  private trackAttached = false;
  private playing = false;
  private enabled = true;
  private disposed = false;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'none';
    this.audio.loop = true;
    this.audio.volume = .3;
  }

  // Called directly from Enter/Resume/Restart to satisfy autoplay policies.
  unlock(enabled: boolean) {
    if (this.disposed || !enabled) return;
    if (!this.trackAttached) this.audio.src = SILENCE;
    this.audio.muted = true;
    void this.audio.play().then(() => {
      if (this.disposed || !this.playing || !this.enabled) this.audio.pause();
      else this.audio.muted = false;
    }).catch(() => { /* Missing track or blocked audio must not block the game. */ });
  }

  setPlaying(playing: boolean, enabled: boolean) {
    if (this.disposed) return;
    this.playing = playing; this.enabled = enabled;
    this.audio.muted = !enabled;
    if (!playing || !enabled) { this.audio.pause(); return; }
    // Attach the remote track only once the city intro or gameplay has begun. Native
    // media playback buffers progressively; never fetch/decode the whole track in JS.
    if (!this.trackAttached) { this.audio.src = MUSIC_URL; this.trackAttached = true; }
    void this.audio.play().catch(() => { /* Audio remains optional. */ });
  }

  reset() {
    this.playing = false; this.audio.pause();
    if (this.trackAttached) this.audio.currentTime = 0;
  }

  dispose() {
    this.disposed = true; this.playing = false; this.audio.pause();
    this.audio.removeAttribute('src'); this.audio.load();
  }
}
