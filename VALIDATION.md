# Validation report

Validated on 2026-10-01 using Node.js 24.18.0 on Windows.

| Check | Result |
| --- | --- |
| `npm run build` | Passed; both routes statically prerendered/exported |
| `npm run typecheck` | Passed |
| `npm test` | 13 passed, 0 failed |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Static HTTP preview | Root plus all 24 exported files returned 200; JavaScript MIME types correct |
| External startup script/style links | None in generated HTML |
| Browser / real WebGL session | Unavailable; not verified |

## Final production size observations

Measured with `npm run size`. Each file is compressed separately; values are bytes, without network headers.

| Output set | Raw | gzip level 9 | Brotli |
| --- | ---: | ---: | ---: |
| Start HTML and its referenced assets, including legacy script | 509,460 | 156,465 | 134,021 |
| All exported JavaScript | 1,372,802 | 393,434 | 333,653 |
| Entire static export, including 404/legacy/metadata assets | 1,413,524 | 406,263 | 344,498 |

The entire export totals about **397 KiB gzip** after the desktop-control visibility and favicon update. This is a conservative file-size upper bound on playable assets, not a measured network transfer. Next.js reports the `/` route at **4.79 kB**, with **108 kB First Load JS**. The engine and Three.js are requested on Play, not included in the initial page's script references. No device startup timing or FPS claim is made.

## Simulation/lifecycle observations

Tests use real Three.js math, scene graphs, and the actual engine with a mocked renderer/DOM. They are not equivalent to interactive browser tests.

- 1,681 generated coordinates preserved passable connections and safe spawn; all five templates were exercised.
- Revisited coordinates regenerated identical building layouts.
- 250 streamed boundary transitions represented 10 km of logical travel. Maximum observed scene objects: **274**. Active chunks: **9 maximum**. Pools remained **16 robots / 32 effects / 3 grenades**. This test moves the player to each next boundary programmatically; it does not measure the time to walk 10 km.
- Twenty resets/resumes did not add listeners or RAF loops. Final disposal removed registered listeners and disposed the mocked renderer. Real GPU disposal remains to be verified.
- One-hit robot kills, shot obstruction, movement obstruction, grenade fuse/radius/obstruction/recharge, jumping, regeneration, attack telegraph, death/retry, and low-mode caps passed automated checks.
- Mobile tests pass for startup/resume without requesting pointer lock, analog movement/sprint, aim/pitch limits, firing/jump/grenade actions, and focus/visibility reset. Controller tests exercise five simultaneous pointers, independent releases, fire-button drag aiming, joystick dead zone and clamping, duplicate-contact ownership, pointer cancellation/capture loss, orientation-resize cleanup, and twenty listener-clean mount/unmount cycles. These use synthetic events, not a physical touchscreen.

## Browser verification limitation

The browser-control tool returned no available browsers. The native computer-use helper repeatedly returned `Computer Use native pipe is unavailable`, including after a runtime reset. Live browser testing could not proceed.

Outstanding manual checks: actual mouse capture/look and continuous movement; pointer-lock Escape/Resume behavior across browsers; physical-phone simultaneous touch, portrait/landscape layout, notches and browser-bar resizing; rendered scene and menu layout; audio playback; real WebGL geometry/texture counts over extended travel; real frame timing; context-loss handling; hydration, browser console, and network panel checks. The browser inventory was checked again during the mobile update and remained empty. Use F3 in development to inspect the diagnostic overlay while traveling and restarting. Production hides this diagnostic toggle.

To repeat the static HTTP check, run `npm start` and then `node scripts/verify-export.mjs http://127.0.0.1:3000`. This verifies served assets but cannot detect hydration or GPU errors.
