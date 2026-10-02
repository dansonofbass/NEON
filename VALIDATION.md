# Survival update validation

Validated 2026-10-02 on Windows. Modified the existing engine and static Next.js export; no dependencies added.

| Check | Result |
| --- | --- |
| `npm.cmd run build` | Passed; static export generated; Next build type/lint stage passed |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd test` | 19 passed, 0 failed |
| Standalone lint | No lint script/configuration exists in this project |
| `node scripts/verify-export.mjs http://127.0.0.1:3017` | Root plus 24 exported files returned 200; correct JavaScript MIME types; no external startup scripts/styles |
| `npm.cmd run size` | Entire export 1,418,646 bytes raw / 407,743 gzip / 345,758 Brotli |
| Real browser/WebGL gameplay | Not performed: computer-use inventory returned no connected browsers; native apps are disabled in this session |

## Causes corrected

- The old pool held only 16 robots (8 in Low), and progression depended on kills rather than survival time. Replacements spawned outside view in an idle state, often unable to detect the player, weakening pressure. All spawned enemies now pursue through the existing shared flow field.
- Spawn selection rejected all forward-facing candidates, had a narrow 15-46 meter ring, and initially spawned faster than two per second. Placement now checks reachable street cells and clearance at 25-65 meters, distributes directions, prefers out-of-view positions with a fallback, and retries once each half second. Living ordinary objects are counted directly; synchronous placement needs no reservations or cached counter. Despawned/dead slots are immediately reusable.
- Shooting was hardcoded to 60 meters and fog ended at 52 meters. The current camera center ray now supports 78-meter visibility within the unchanged 3x3 streamed neighborhood, stopping at unloaded terrain. World-space hitboxes avoid stale mesh matrices and remain consistent through floating-origin shifts. Tests found no original pitch-sign defect; the camera ray removes duplicated aiming math.
- Boolean health and unconditional kills could not support bosses. Numeric shared damage now keeps ordinary health at 1 and boss health at 20. Bullets deal 1; grenades deal 5 once per visible, unoccluded target. Enemy hitscan attacks deal 10 or 50 once after their telegraph and recheck walls when firing. Regeneration waits five seconds and heals eight per second.

## Automated evidence

Tests run the real engine and Three.js math/scene graph with mocked DOM, audio, RAF and renderer. They do not establish rendered gameplay, hydration, GPU disposal, device FPS or physical input behavior.

- Exact ordinary 10-damage hit; boss 50-damage hit; no repeated damage during cooldown; wall obstruction.
- Ordinary one-bullet kill; boss survives 19 bullets and dies on 20; grenade deals five boss health once.
- Targets 12/14/16/20 at 0/1/3/5 minutes and 40/24 caps; pause freezes time; Restart clears schedules, pending encounters and breathing timers.
- Boss milestones at 180-second intervals, one queued encounter across repeated milestones, five-second breathing period, failed placement retries, and same-object health-preserving relocation.
- 70-meter hits, pitched camera shots, wall obstruction and floating-origin aiming.
- Repeated kills/replenishment through 35 programmatic travel transitions. Placement failures retry without losing the population deficit.
- 250 chunk transitions / 10 km logical travel retained at most nine chunks, 502 scene objects, and fixed pools of 40 ordinary robots, one boss, 32 effects and three grenades. This is CPU object accounting, not a GPU measurement.
- Existing generation, grenade, lifecycle, touch-controller and listener-cleanup tests remain passing.

## Manual checks still needed

Use `npm run dev` with `/?survivalSpeed=60` to accelerate only survival progression (clamped 1-60). Production ignores this query. F3 exposes development diagnostics.

Verify rendered HUD/mobile layout, boss visibility/telegraphs and directional marker, sustained live movement/shooting across streets, pointer lock, audio, actual pause/resume and restart inputs, phone multitouch, hydration/browser console, and real GPU/resource/frame-time stability over prolonged play. No successful interactive browser testing is claimed.

## Game Over and music follow-up (2026-10-02)

- Added descending red Game Over wash, Restart and Main Menu; Escape/pause now
  presents the original menu design with Resume Run and Restart.
- Added optional looping `public/audio/gameplay.mp3` playback. It follows the sound
  setting and game status, preserves track position on Resume, rewinds on Restart,
  and releases its media source on unmount. MIDI playback is not implemented.
- Latest production build and standalone typecheck passed. All 22 tests passed,
  including three mocked-audio tests for lifecycle, late autoplay resolution after
  menu/disposal, and missing-track/autoplay failures. Build reports 5.43 kB for `/`
  and 108 kB First Load JS. The size/HTTP figures above are from the survival pass.
- No track was supplied, so audible playback has not been tested. Browser visual
  verification of the death overlay and menus remains outstanding.

## Long-track loading follow-up (2026-10-02)

- Real music has no source attached on landing or while loading the engine. A
  124-byte local WAV silence sample handles the first gesture without a remote
  music request. Gameplay attaches the external track; native audio manages its
  buffering, with no complete-file fetch/Blob/decode in game JavaScript.
- Added one-hour audio browser caching configuration for the static Vercel export.
  Deployment headers have not been verified against a live Vercel URL.
- Static preview now streams files and supports byte ranges, suffix/open-ended
  ranges, HEAD, and unsatisfiable-range responses. Tests verify a 1 MiB fixture
  returns the exact requested bytes and lengths. This is server behavior, not an
  audible playback or slow-network browser test.
- All 24 tests, production build and standalone typecheck passed. Production `/`
  route is 5.55 kB; First Load JS stays 108 kB. No actual music file was provided,
  so encoding quality, mobile buffering and real network transfer remain untested.

## Cinematic opening follow-up (2026-10-02)

- Added an eight-second aerial prologue in the existing renderer. Waits for nine
  loaded chunks, freezes survival/combat and input, pauses on focus/visibility loss,
  resumes remaining time and resets on Restart. Music starts with intro and is not
  restarted at gameplay handoff. The configured timeline is exactly 8 active seconds;
  the visible handoff occurs at the next rendered frame, as with any RAF animation.
- All 27 tests passed, including new timeline/loading/input/pause/reset tests and
  800 sampled camera positions checked against building bounds. The last camera
  pose approaches the player position and aiming direction continuously.
- Production build and standalone typecheck passed. Static HTTP validation passed:
  root + 26 exported files. Supplied MP3 is 17,408,981 bytes, has an ID3 header, and
  returns audio/mpeg plus HTTP 206 with exactly the requested first 1,024 bytes.
- Browser inventory returned no apps or browsers. No rendered cinematic, actual
  audio playback/synchronization, or on-device performance claim is made. Manual
  visual QA remains required, especially framing on wide and portrait screens.
