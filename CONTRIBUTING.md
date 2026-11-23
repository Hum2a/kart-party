# Contributing to Kart Party

Thank you for helping improve **Kart Party**! This guide covers local setup, architectural guardrails, and how to submit clean pull requests.

## Prerequisites

- **Node.js `>= 22.12.0`**
- **npm** — this repository uses **npm workspaces only** (never `pnpm` or `yarn`).

```sh
npm install
npm run dev   # http://localhost:5180 (Vite + workerd Durable Objects)
```

---

## Workspace Rules & Conventions

Please respect the architectural boundaries documented in [AGENTS.md](AGENTS.md):

1. **One rulebook (`RaceSession`)** — Every race (solo practice or online multiplayer) must run through [`RaceSession`](packages/game/src/session.ts). Never introduce a parallel race loop, physics step, or scoring path.
2. **Authoritative online rooms** — Browsers send intents; [`KartRoom`](apps/worker/src/room.ts) owns the roster, host, phase, race clock, places, and wins, and persists state before acknowledging.
3. **Injected time only in `packages/game`** — Never call `Date.now()` inside [`packages/game`](packages/game). Keep it free of DOM, React, Three.js, and Worker APIs.
4. **Original content only** — Tracks, karts, drivers, and sounds are drawn/synthesised in code. Do not import or adapt assets, names, characters, or tracks from existing games (even renamed).
5. **Frames, not React state** — The 3D canvas reads race state via refs and `requestAnimationFrame`. Never call React `setState` every frame.
6. **Keep `three` isolated** — Keep all `three` imports inside [`apps/web/src/kart`](apps/web/src/kart) and behind `React.lazy()` so the landing page stays fast and lightweight.
7. **Player-facing copy** — Use **British English** (e.g., _Practise_, _chequered_, _metres_, _recognised_), ensure accessible controls, and honour `prefers-reduced-motion`.

---

## Before Opening a Pull Request

Run the full verification suite and make sure all checks pass without skipping or disabling tests:

```sh
npm run format:check
npm run typecheck
npm test
npm run build      # required if web modules, assets, or Vite config changed
```

To auto-format your changes with Prettier (`printWidth: 88`):

```sh
npm run format
```

> [!IMPORTANT]
> Never skip, `.only`, or delete a failing test to get green. Fix the underlying bug or ask in your PR description. Also, do not run `npm run deploy` unless explicitly requested by the repository owner.
