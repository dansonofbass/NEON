# NEON DRIFT

**Enter the grid. Survive the chaos. Keep moving.**

A neon-soaked, browser-based 3D FPS built with **Next.js, TypeScript, and Three.js**.

What started as a small experiment with 3D graphics turned into a playable survival shooter featuring procedural environments, enemy AI, boss encounters, and real-time combat.

No installation. No account. Just open your browser and play.

### [PLAY THE GAME](https://neon-sandy-sigma.vercel.app/)

[Report a Bug](https://github.com/dansonofbass/NEON/issues) · [Share an Idea](https://github.com/dansonofbass/NEON/discussions) · [Contribute](CONTRIBUTING.md)

---

## The Game

You're dropped into a neon city filled with hostile robots.

Move through the streets, take down enemies, survive increasingly difficult encounters, and prepare for boss fights.

The longer you survive, the more intense things get.

There's no traditional level progression. The city keeps generating around you, enemies keep coming, and survival is the objective.

### Features

- **Endless survival** — Increasing enemy populations as the game progresses.
- **Procedural city** — A deterministic world that generates around the player.
- **Enemy AI** — Robots that detect, chase, navigate, and attack.
- **Boss encounters** — Tougher enemies appearing at survival milestones.
- **FPS combat** — Shooting, limited ammunition, grenades, movement, and jumping.
- **Dynamic difficulty** — Combat becomes more challenging over time.
- **Real-time 3D graphics** — Built with Three.js and WebGL.
- **Desktop and mobile controls** — Keyboard, mouse, and touch input.
- **Performance settings** — Quality options and adaptive resolution.
- **Music and sound** — Gameplay audio and visual feedback.
- **Cinematic opening** — An eight-second introduction to the game world.

The game runs directly in the browser without a traditional game engine.

---

## Tech Stack

| Technology | Role |
|---|---|
| Next.js | Application framework and static delivery |
| React | Menus, HUD, and application UI |
| TypeScript | Game and application logic |
| Three.js | 3D rendering and scene management |
| WebGL | Browser-based graphics |
| Web Audio / HTML Audio | Sound and music |
| Node.js / npm | Development and build tooling |
| Vercel | Deployment and hosting |

The project focuses on building and managing real-time gameplay with web technologies rather than using a dedicated engine such as Unity or Unreal.

---

## Why I Built This

I wanted to experiment with something outside the usual web application workflow.

Instead of building another dashboard or website, I wanted to explore what happens when you use modern web technologies for a real-time 3D experience.

That meant working through challenges like:

- Managing a continuous game loop
- Separating game simulation from React rendering
- Handling collision detection and shooting mechanics
- Building procedural environments without growing memory usage indefinitely
- Implementing enemy behavior and navigation
- Supporting keyboard, mouse, and mobile touch input
- Keeping rendering and gameplay performance under control

The result is NEON DRIFT.

It's playable, but it's also an ongoing experiment. There are still plenty of things to improve, rethink, and explore.

---

## Play NEON DRIFT

**Live demo:** https://neon-sandy-sigma.vercel.app/

For the best initial experience, use a desktop browser with WebGL2 support.

Mobile browsers with compatible touch and WebGL2 support can also run the game. Landscape orientation is recommended.

### Desktop Controls

| Control | Action |
|---|---|
| W / A / S / D | Move |
| Mouse | Aim |
| Left Mouse Button | Shoot |
| Shift | Sprint |
| Space | Jump |
| G | Throw a grenade |
| Escape | Pause / release mouse |
| F3 (development only) | Performance diagnostics |

### Mobile Controls

- **Left joystick:** Move and sprint.
- **Right-side swipe:** Aim.
- **Fire button:** Shoot; drag while holding to adjust aim.
- **Jump button:** Jump.
- **Grenade button:** Throw a grenade.
- **Pause button:** Open the pause menu.

Touch controls are enabled automatically for supported mobile input devices.

---

## Run Locally

### Requirements

- Node.js 22.18 or later (Node.js 24 recommended)
- npm
- A modern browser with WebGL2 support

### Installation

Clone the repository:

```bash
git clone https://github.com/dansonofbass/NEON.git
cd NEON
```

Install dependencies:

```bash
npm ci
```

Start the development server:

```bash
npm run dev
```

Open:

http://localhost:3000

On Windows PowerShell, if script execution policies block npm, use `npm.cmd` instead.

### Production Preview

```bash
npm run build
npm start
```

The production build is exported as a static application.

`npm start` serves the exported `out/` directory using the project's local preview script.

Do not use `next start` for this static export.

---

## How It Works

NEON DRIFT separates the React application from the real-time game simulation.

React handles the user interface, menus, and HUD, while Three.js and the game engine handle the 3D world.

### Game Loop

The game uses:

- A single `requestAnimationFrame` loop
- Fixed-step simulation targeting 60 Hz
- A maximum of five catch-up simulation steps
- Frame delta clamping
- Pausing when the page becomes hidden or loses focus

This keeps game simulation more predictable while allowing rendering to follow browser frame timing.

Actual frame rates depend on the device and browser.

### Procedural World

The city is generated using deterministic chunks.

Key ideas:

- 40-meter world chunks
- A 3×3 active neighborhood around the player
- Deterministic generation using a fixed seed
- Connected street layouts
- Gradual chunk creation to distribute work across frames
- A floating-origin system to manage movement across large distances

As the player moves, unnecessary chunks are unloaded and nearby chunks are generated.

The world isn't stored indefinitely in memory.

Previously visited areas can be reconstructed from their coordinates.

### Enemy AI

Enemies use a state-based behavior system:

- Idle
- Detect
- Chase
- Attack
- Dead

Enemy movement also uses collision checks, line-of-sight checks, and shared navigation data.

The goal is to keep enemy behavior understandable and reasonably efficient without introducing a large AI framework.

### Combat

The combat system includes:

- Camera-based hitscan shooting
- Finite ammunition and kill rewards
- Enemy and building hit detection
- Grenades with explosion radius and obstruction checks
- Damage telegraphs
- Health regeneration
- Boss health and combat behavior

Shooting checks whether a building blocks the target rather than automatically registering a hit through geometry.

### Survival Progression

Enemy populations increase as active survival time progresses.

Ordinary enemies become more numerous instead of gaining more health.

Boss encounters are scheduled at survival milestones.

The simulation also manages enemy population limits, spawn placement, cooldowns, and active encounters.

Pausing the game stops survival progression.

### Rendering and Performance

NEON DRIFT uses several techniques to limit rendering and simulation costs:

- Shared geometry and materials
- Instanced environment geometry
- Fixed pools for enemies, grenades, and effects
- Limited active world chunks
- Configurable rendering quality
- Adaptive pixel ratio
- Reduced simulation work for distant or inactive systems
- Resource cleanup when the game engine is destroyed

The environment relies primarily on procedural geometry and materials rather than downloaded textures or 3D asset packs.

### Audio

The game includes synthesized sound effects and gameplay music.

Music responds to game states such as pause, restart, and game over.

The gameplay music file is located at:

`public/audio/gameplay.mp3`

Additional audio notes are available in `public/audio/README.md`.

---

## Project Structure

Some of the main areas of the repository:

```text
NEON/
├── app/                 # Next.js application
│   └── ui/              # React UI and game integration
├── game/
│   ├── engine.ts        # Core simulation and gameplay
│   ├── types.ts         # Shared game types
│   └── music.ts         # Music integration
├── public/
│   └── audio/           # Gameplay music and audio assets
├── tests/               # Automated tests
├── next.config.ts       # Next.js configuration
├── vercel.json          # Vercel deployment configuration
├── VALIDATION.md        # Validation and build measurements
├── CONTRIBUTING.md      # Contribution guidelines
└── README.md
```

This is an overview of the main components, not an exhaustive file tree.

---

## Testing and Validation

The project includes automated tests covering game simulation and input behavior.

Run the available checks with:

```bash
npm run typecheck
npm test
npm run build
npm run size
```

Test coverage includes areas such as:

- Deterministic world generation
- Collision and shooting obstruction
- Enemy and boss damage
- Grenade behavior
- Health regeneration
- Game resets and restarts
- World streaming and resource limits
- Mobile input and multitouch handling
- Pointer lock and pause behavior

The simulation tests use Three.js math and scene objects while mocking browser and rendering dependencies where needed.

Automated tests are not a replacement for real browser and device testing.

Performance, input behavior, rendering quality, and mobile compatibility should also be verified manually.

See `VALIDATION.md` for additional validation details and measured production bundle sizes.

---

## Deployment

NEON DRIFT is deployed on Vercel.

**Live deployment:** https://neon-sandy-sigma.vercel.app/

The project uses static export with Next.js.

### Deploy Your Own Version

1. Fork or clone the repository.
2. Push it to your Git provider.
3. Import the repository into Vercel.
4. Use the **Other** framework preset.
5. Configure the deployment using:

| Setting | Value |
|---|---|
| Node.js | 24 |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `out` |

The committed `vercel.json` configures static hosting.

No environment variables or application secrets are required for the current gameplay implementation.

---

## Roadmap

NEON DRIFT is still evolving. These are potential directions for future development, not commitments or completed features.

### Gameplay

- More enemy types and behaviors
- New weapons and combat mechanics
- Improved combat feedback
- More varied boss encounters
- Additional survival challenges

### Graphics and World

- More environmental variety
- Improved visual effects
- Additional procedural structures
- Better lighting and atmosphere
- Further GPU and rendering optimization

### User Experience

- Better onboarding for new players
- Accessibility improvements
- Expanded control customization
- Improved gameplay feedback
- Better mobile playability

### Engineering

- More automated tests
- Browser-based integration testing
- Performance profiling on real devices
- Clearer code documentation
- Improved contributor tooling

The roadmap is open to discussion and community suggestions.

---

## Open Source & Contributions

**NEON DRIFT is open for contributions.**

This project started as a personal experiment, but I'd love to see what other developers can bring to it.

You don't need to be an experienced game developer to contribute.

If you enjoy working with TypeScript, Three.js, React, graphics, performance optimization, game mechanics, or creative web projects, there's room to get involved.

### How You Can Help

- **Found a bug?** [Open an issue](https://github.com/dansonofbass/NEON/issues).
- **Have a feature idea?** [Start a discussion](https://github.com/dansonofbass/NEON/discussions).
- **Want to improve something?** Fork the repository and submit a pull request.
- **New to open source?** Look for issues labeled [`good first issue`](https://github.com/dansonofbass/NEON/labels/good%20first%20issue).
- **Looking for something to work on?** Check [`help wanted`](https://github.com/dansonofbass/NEON/labels/help%20wanted).

Small, focused improvements are always welcome.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting your first pull request.

For larger features, opening an Issue or Discussion first is encouraged so we can talk about the approach.

### Let's Build Something Together

I'm especially interested in hearing from developers who enjoy experimenting with real-time browser experiences.

What would you improve?

What gameplay mechanic would make NEON DRIFT more interesting?

What would you do differently from an architectural or performance perspective?

Play the game, explore the code, and share your thoughts.

**[Join the Discussion](https://github.com/dansonofbass/NEON/discussions)**

---

## Known Limitations

The project is playable, but some areas remain intentionally limited.

Current limitations include:

- A relatively small family of procedural street templates
- No building interiors, rooftops, or vehicles
- No persistent changes to the generated world
- Coarse enemy navigation in some situations
- Limited customization of mobile controls
- No automatic recovery from a lost WebGL context beyond reloading
- Performance not yet fully validated across physical devices and browsers

Some future improvements may require changes to the current architecture.

These limitations are also opportunities for experimentation and community contributions.

---

## Credits

Created and maintained by [dansonofbass](https://github.com/dansonofbass).

Built using Next.js, TypeScript, and Three.js.

Thanks to everyone who plays, reports bugs, suggests ideas, or contributes code.

---

**[Play NEON DRIFT](https://neon-sandy-sigma.vercel.app/) · [Explore the Code](https://github.com/dansonofbass/NEON) · [Join the Community](https://github.com/dansonofbass/NEON/discussions)**

*Enter the grid. See how long you survive.*
