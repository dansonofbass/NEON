# NEON DRIFT

A complete single-player browser FPS built with Next.js App Router, TypeScript, and Three.js. All scenery is local geometry; sound is synthesized. No gameplay services, accounts, secrets, external assets, or runtime asset downloads.

## Run locally

Use Node.js 22.18+ (Node 24 recommended) and npm. The lockfile is committed.

```sh
npm ci
npm run dev
```

Open http://localhost:3000 in a WebGL2-capable browser. Keyboard/mouse and mobile touch controls are supported. On Windows PowerShell with script execution disabled, use `npm.cmd` in place of `npm`.

Production preview:

```sh
npm run build
npm start
```

`npm start` serves the exported `out/` directory on http://127.0.0.1:3000 using a small local preview script. It is not a production backend. Stop the development server first, or choose a different `PORT` environment variable. Do not use `next start` with this static export.

## Play

Click **Enter the grid**. The static start screen appears before the engine is downloaded. The first click requests pointer lock while loading the engine. If the browser declines or releases capture during loading, click **Enter the grid** again when ready. Escape releases the mouse and pauses; Resume requests capture again.

On a phone or tablet with a coarse primary pointer and no hover, the game starts without pointer lock and defaults to **Low** quality when no preference has been saved. Touch controls are automatically enabled only for that input profile. Desktop mouse/trackpad devices keep keyboard/mouse controls, even in a narrow window or with a secondary touchscreen attached. CSS also hides the touch overlay outside the mobile/tablet input profile. Changing the primary input pauses the game before switching controls.

### Mobile controls

- Left circular joystick: analog movement. Push toward the front edge to sprint.
- Swipe the right side: aim. Hold the large pink fire button to shoot; drag that same finger to aim while firing.
- Separate jump and grenade buttons support simultaneous touches with the joystick and aiming controls.
- Top-right pause button opens the menu. Returning from another app pauses the game and clears held input.
- Landscape is recommended; portrait also works. Menus scroll on short screens, with safe-area spacing around notches and browser bars. Rotating the device releases held touches; put your thumbs back on the controls to continue.

Touch input uses Pointer Events and per-finger capture, with cleanup on release, cancellation, capture loss, resize, pause, and unmount. Joystick visuals update directly without per-move React renders. A recent Android/iOS browser with WebGL2 is required; actual phone performance is not yet measured. To test on a phone, deploy to Vercel and open the HTTPS link there; `localhost` on a phone refers to the phone, not your computer.

| Control | Action |
| --- | --- |
| WASD | Move |
| Mouse | Aim |
| Hold left mouse | Automatic fire, unlimited ammunition |
| Shift | Sprint |
| Space | Jump |
| G | Throw a grenade |
| Escape | Pause / release mouse |
| F3, development only | Toggle performance diagnostics |

Ordinary robots die in one bullet hit. Buildings block shots. Start with 200 health; ordinary attacks flash amber for 0.75 seconds before dealing exactly 10 damage, with a 2.4-second cooldown. Boss attacks telegraph for 1.1 seconds, deal exactly 50 damage, and cool down for 3 seconds. These are confirmed hitscan attacks, not per-frame contact damage. Health regenerates at 8/second after at least 5 seconds without damage. Grenades have a 1.65-second fuse and an 8-meter lethal radius, respect building obstruction, and do not hurt you. Carry three charges; each spent charge replenishes in four seconds, sequentially. At most three grenades can exist at once. Retry and Restart reset the run while retaining the renderer and shared pools.

Standard quality caps pixel ratio at 1.25 and begins with a target of 12 robots, populated incrementally outside view. Every completed minute of active simulation increases the target using `min(cap, ceil(12 * 1.10 ** minutes))`; ordinary health never increases. The cap is 40 in Standard. Low caps pixel ratio at 0.8, active ordinary robots at 24, and simultaneous effects at 16 instead of 32. Sustained frame time above 27 ms for six seconds reduces Standard's pixel ratio cap to 0.85 and displays **Adaptive resolution active**. Changing quality resets that adaptation. Sound and mild weapon recoil can be toggled independently. Settings and best score are the only stored data; blocked storage is harmless.

## Deploy to Vercel

1. Push the repository, including `package-lock.json`, to your Git provider.
2. Import it as a new Vercel project using the **Other** preset. The committed `vercel.json` sets `framework: null` for static hosting.
3. Use Node.js 24, install command `npm ci`, build command `npm run build`, and output directory `out`.
4. Deploy. No environment variables or secrets are required.

`next.config.ts` sets `output: 'export'`. There are no route handlers, server actions, middleware, or server-side browser APIs. The exported `out/` also works on any static HTTP host at the domain root. Subdirectory hosting would require setting Next's `basePath` before building.

## Architecture and bounds

- React renders menus and the HUD at 10 Hz. Engine state remains in `game/engine.ts`; it is dynamically imported only on Play.
- One RAF loop, fixed 60 Hz simulation, maximum five catch-up steps, and frame deltas clamped to 100 ms. Hidden documents suspend simulation and rendering. Focus/pointer-lock loss clears input and pauses.
- Deterministic 40-meter chunks from seed `73129`; five templates reserve compatible cross-shaped street connections. Building colliders are independent of instanced visual geometry.
- Only the surrounding 3×3 chunks exist. The initial chunk builds immediately; at most one additional chunk (maximum eight buildings) builds per rendered frame. That is a strict work-count budget, not a guaranteed millisecond duration. Incoming chunks are ordered toward the player's view at the boundary transition. Unloaded chunks remain solid to player, enemies, and grenades.
- A floating origin recenters at each chunk crossing. Logical integer chunk coordinates determine layouts; local player, chunk, robot, effect, and grenade coordinates shift together.
- No explored-coordinate history, corpses, or historical combat state. Revisiting distant coordinates reconstructs the same buildings with fresh encounters.
- Shared cube/icosahedron geometry and materials, per-chunk instanced building/window/sign batches, fixed 40-ordinary/1-boss/32-effect/3-grenade pools. No shadows, postprocessing, textures, or downloaded art. Bright opaque materials provide neon.
- Enemies use idle/detect/chase/attack/dead states, staggered line-of-sight checks, collision-aware movement, and a shared 30×30 navigation flow grid rebuilt at most every 0.7 seconds (or after streaming). Attacks require a fresh obstruction check.
- Teardown cancels RAF, removes listeners, stops audio, closes the audio context, disposes chunk instance resources and shared GPU resources, and removes the canvas. Restart reuses the same loop/listeners.

## Validation

```sh
npm run typecheck
npm test
npm run build
npm run size
```

Twenty-seven automated tests pass. They cover deterministic regeneration, safe connections in 1,681 chunks, one-hit kills, shot/movement obstruction, grenade fuse/radius/obstruction/recharge/cap, jumping, health regeneration, attack telegraph/death/reset, pointer-lock event pause behavior, twenty restarts, and low-quality pool limits. Mobile tests cover pointer-lock-free startup, analog movement/sprint, aim/pitch limits, fire/jump/grenade actions, independent simultaneous fingers, joystick dead zone/clamping, capture cancellation, resize, focus loss, and listener cleanup.

The engine tests execute the actual simulation with real Three.js math/scene objects, but mock the DOM and renderer. A 250-transition / 10 km streaming test observed a maximum of **502 scene objects**, **9 chunks**, and fixed pools of **40 ordinary enemies, one boss, 32 effects, and 3 grenades**. This measures CPU object bounds, not GPU resources or actual continuous user travel.

Production static export and TypeScript checks pass. No separate ESLint dependency/configuration is installed. `npm audit` reports zero vulnerabilities with the lockfile; the PostCSS override updates Next's transitive build dependency.

**Browser checks remain unverified:** the available browser tool reported no connected browsers, and the desktop automation helper could not connect. Consequently, real pointer-lock/mouse behavior, physical-phone multitouch and orientation handling, rendered visual quality, WebGL context recovery, hydration/console/network behavior, and on-device FPS/startup times were not measured. No 60 FPS or load-time claim is made.

For a manual browser pass: enter, move/aim/fire, Escape/Resume, walk into a wall, shoot robots in open streets and behind walls, throw grenades, travel through multiple intersections, retrace the route, restart repeatedly, and check the console. In `npm run dev`, F3 shows FPS/frame time, draw calls/triangles, chunks, enemies, active effects, and renderer geometry/texture counts. Watch those counts stabilize while traveling; exact GPU counts have not been measured here.

## Measured production sizes

See `VALIDATION.md` for measured sizes from the final build. `npm run size` sums individual output files using gzip level 9 and Brotli. These are local compression measurements, not observed Vercel network transfers; response headers, caching, browser support, and hosting compression differ. Counting the entire export conservatively includes framework/404/legacy files a modern game session may never fetch.

## Known limitations

No interiors, rooftops, pickups, vehicles, or persistent world changes. Streets deliberately repeat a small family of connected templates. Grenade collision uses conservative full-height building columns; effects are opaque geometric flashes. Navigation is coarse and robots can bunch together or hesitate at corners. World coordinates are practical finite JavaScript numbers, not literally infinite. Device performance and live-browser resource stability need a local browser pass, including a physical-phone multitouch test. Mobile controls have fixed positions; there is no control-layout editor or aim assist. A lost WebGL context offers a full reload rather than attempting partial GPU restoration.

## Endless survival update

The compact HUD displays active survival time, ordinary population/target, boss health, distance, off-screen bearing, and queued encounters. Pause, blur and hidden pages freeze progression; Restart clears schedules and the whole run. Spawns retry synchronously every 0.5 simulation seconds, at most one ordinary robot each check, so no pending reservation can oversubscribe the pool. The starting target of 12 fills gradually over roughly six seconds, subject to valid placements. Spawn candidates use loaded street centers 25?65 meters away, a reachable flow-field cell, clearance, spacing, and rotating direction preferences. Out-of-view placement is preferred, with a late visible fallback. Robots pursue immediately instead of waiting idle out of sight.

Boss encounters occur every 180 active seconds. A boss has 20 health versus an ordinary robot's 1, and player bullets always deal 1. Grenades deal 5 through the same damage path. Only one boss is active; one encounter can wait, then gets a five-second breathing period. Failed placement keeps retrying. Travel relocates the same boss with its remaining health into the current loaded neighborhood. Bosses use enlarged shared low-poly geometry and amber armor accents.

Shooting uses the camera's current center ray and numeric world-space hitboxes, selecting the nearest enemy before a building. Visibility and firing reach are 78 meters maximum within the existing nine chunks (less at an unloaded boundary), rather than extending streaming to promise 150 meters. The automated suite verifies a 70-meter hit, pitched aim, and floating-origin consistency.

Development milestone shortcut: run `npm run dev` and open `/?survivalSpeed=60`. Values from 1 to 60 accelerate only progression; movement, spawn rate, attack cooldowns and the five-second boss breathing period remain normal. The query is ignored in production. F3 toggles diagnostics.

## Game Over, menu and music

Death shows a red wash descending from the top, GAME OVER, Restart and Main Menu.
Restart resets the run; Main Menu disposes the finished engine and returns to the
initial screen. Escape pauses and shows the original main-menu design with Resume
Run and Restart, preserving progress until Restart is chosen.

Put your track at `public/audio/gameplay.mp3` (exact lowercase name), then rebuild
and deploy normally. It loops at 30% volume during gameplay, follows SOUND ON/OFF,
pauses on focus loss/menu/death, resumes on Resume, and rewinds on Restart. The supplied gameplay.mp3 is present in public/audio. A missing track never prevents gameplay. For OGG/WAV, change
`MUSIC_URL` in `game/music.ts` to the actual file; MP3 is recommended. MIDI files need
to be rendered/exported to MP3 first; renaming `.mid` to `.mp3` does not convert it.

Long tracks: remote music is attached only once the city intro begins with sound enabled,
so it does not compete with the initial engine import. A tiny inline silence sample
handles the initial audio unlock. Native media buffering avoids loading/decoding the
whole track in JavaScript. Audio URLs use a one-hour browser cache on Vercel; change
the filename and MUSIC_URL when replacing a cached track. Recommended budget: a
3-5 minute MP3 loop at 128 kbps, roughly 3-5 MB. See public/audio/README.md for details.

## Eight-second cinematic opening

Every new run, including Restart, begins with an eight-second active-time city
flyover: a high aerial glide, then a smooth descent along the clear central street
into the player camera. The existing renderer and nine chunks are reused, with
cinematic framing, a narrower lens, fog adjustment, letterbox bars and crisp HTML
text. No new models, video downloads, shadows or postprocessing are introduced.

The first four seconds show READY TO SAVE THE CITY?; the second four show
WAY BACK, BACK INTO TIME. Music begins with the intro and continues through the
handoff without restarting. The eight-second clock begins after the neighborhood
has loaded, uses active frame time independently of the accelerated survival clock,
and transitions on the first rendered frame at or after eight seconds. Escape,
blur and hidden pages pause it; Resume finishes the remaining duration. Gameplay
input, enemies and survival scheduling stay inactive until the handoff.
