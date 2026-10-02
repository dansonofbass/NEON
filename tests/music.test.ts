import test from 'node:test';
import assert from 'node:assert/strict';
import { GameMusic, MUSIC_URL } from '../game/music.ts';

class FakeAudio {
  static last: FakeAudio;
  preload = ''; loop = false; volume = 1; muted = false;
  currentTime = 0; paused = true; released = false;
  resolvePlay: (() => void) | null = null;
  src: string;
  constructor(src = '') { this.src = src; FakeAudio.last = this; }
  play() { this.paused = false; return new Promise<void>(resolve => { this.resolvePlay = resolve; }); }
  pause() { this.paused = true; }
  removeAttribute() { this.src = ''; }
  load() { this.released = true; }
}
Object.assign(globalThis, { Audio: FakeAudio });

test('music follows gameplay, sound toggle, resume, reset and disposal', () => {
  const music = new GameMusic(), audio = FakeAudio.last;
  assert.equal(audio.src, ''); assert.equal(audio.loop, true); assert.equal(audio.preload, 'none');
  music.setPlaying(true, true); assert.equal(audio.src, MUSIC_URL); assert.equal(audio.paused, false);
  audio.currentTime = 42; music.setPlaying(false, true); assert.equal(audio.paused, true);
  music.setPlaying(true, true); assert.equal(audio.currentTime, 42);
  music.setPlaying(true, false); assert.equal(audio.paused, true); assert.equal(audio.muted, true);
  music.reset(); assert.equal(audio.currentTime, 0); assert.equal(audio.paused, true);
  music.dispose(); assert.equal(audio.src, ''); assert.equal(audio.released, true);
  music.setPlaying(true, true); assert.equal(audio.paused, true);
});

test('late autoplay unlock cannot resume music after returning to menu or disposal', async () => {
  const music = new GameMusic(), audio = FakeAudio.last;
  music.unlock(true); assert.equal(audio.muted, true);
  music.setPlaying(false, true); audio.resolvePlay!(); await Promise.resolve();
  assert.equal(audio.paused, true);
  music.unlock(true); const done = audio.resolvePlay!; music.dispose(); done(); await Promise.resolve();
  assert.equal(audio.paused, true);
});

test('missing track and autoplay rejection do not reject the game lifecycle', async () => {
  const music = new GameMusic(), audio = FakeAudio.last;
  audio.play = () => Promise.reject(new Error('Missing track'));
  music.unlock(true); music.setPlaying(true, true); await Promise.resolve();
  music.reset(); music.dispose();
});

test('no remote audio loads on landing, muted starts or while the engine loads', async () => {
  const music = new GameMusic(), audio = FakeAudio.last;
  assert.equal(audio.src, '');
  music.unlock(false); music.setPlaying(true, false); assert.equal(audio.src, '');
  music.unlock(true); assert.ok(audio.src.startsWith('data:audio/wav;base64,'));
  assert.ok(audio.src.length < 256, 'only a tiny in-memory silence sample');
  music.setPlaying(false, true); audio.resolvePlay!(); await Promise.resolve();
  assert.notEqual(audio.src, MUSIC_URL);
  music.setPlaying(true, true); assert.equal(audio.src, MUSIC_URL); music.dispose();
});
