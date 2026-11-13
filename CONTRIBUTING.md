# Contributing to NEON DRIFT

First of all, thanks for checking out NEON DRIFT!

This project started as a small experiment with Three.js and TypeScript, and I'd love to see what other developers can bring to it.

Whether you're experienced with game development or just getting started with open source, you're welcome here.

## Ways to Contribute

There are plenty of ways to get involved:

- Report bugs or unexpected gameplay behavior.
- Suggest new weapons, enemies, levels, or mechanics.
- Improve graphics, animations, and visual effects.
- Optimize rendering and performance.
- Improve mobile controls and accessibility.
- Add tests or improve documentation.
- Contribute code through pull requests.

Small improvements are just as valuable as larger features.

## Getting Started

### 1. Fork the repository

Click **Fork** in the top-right corner of the repository:

https://github.com/dansonofbass/NEON

### 2. Clone your fork

```bash
git clone https://github.com/YOUR_USERNAME/NEON.git
cd NEON
```

Replace `YOUR_USERNAME` with your GitHub username.

### 3. Install dependencies

Use Node.js 22.18+ (Node.js 24 recommended).

```bash
npm ci
```

### 4. Start the development server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### 5. Create a branch

Please don't work directly on `main`.

```bash
git checkout -b feat/your-feature-name
```

Use meaningful names such as:

- `feat/new-enemy-type`
- `fix/mobile-controls`
- `perf/optimize-rendering`
- `docs/improve-setup-guide`

## Before You Start Coding

For small fixes, feel free to open a pull request.

For larger features, please open an Issue or Discussion first so we can talk about the idea and avoid duplicated work.

- [Open Issues](https://github.com/dansonofbass/NEON/issues)
- [Join Discussions](https://github.com/dansonofbass/NEON/discussions)
- [Good First Issues](https://github.com/dansonofbass/NEON/labels/good%20first%20issue)

## Coding Guidelines

- Use TypeScript and follow the existing code style.
- Keep gameplay logic separate from React UI where possible.
- Avoid unnecessary dependencies.
- Consider performance and memory usage.
- Clean up event listeners, timers, and Three.js resources.
- Keep changes focused and easy to review.
- Add or update tests when changing gameplay behavior.

## Testing

Before submitting a pull request, run:

```bash
npm run typecheck
npm test
npm run build
```

For performance-related changes, consider running:

```bash
npm run size
```

If something fails, explain it in your PR.

## Submitting a Pull Request

1. Commit your changes with a descriptive message.
2. Push your branch to your fork.
3. Open a Pull Request against the original repository's `main` branch.
4. Describe what you changed and why.
5. Link any related Issue.
6. Include screenshots or gameplay clips for visual changes.

Example commit messages:

- `feat(game): add new enemy attack pattern`
- `fix(mobile): correct joystick movement`
- `perf(render): reduce unnecessary allocations`
- `docs: clarify development setup`

Please be open to feedback and review before merging.

## Community Guidelines

Be respectful, constructive, and welcoming.

Different approaches and ideas are encouraged. Technical disagreements should focus on the code and the problem, not the person.

## Questions or Ideas?

Not sure where to start?

[Start a Discussion](https://github.com/dansonofbass/NEON/discussions) and introduce your idea.

I'd be happy to discuss different approaches, gameplay mechanics, architecture, or performance improvements.

Thanks for helping make NEON DRIFT better!

**[Play the Game](https://neon-sandy-sigma.vercel.app/) · [GitHub](https://github.com/dansonofbass/NEON)**
