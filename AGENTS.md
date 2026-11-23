# Kart Party: agent instructions

A browser kart racer. npm workspaces only (never pnpm or yarn).

## Layout

| Path            | Role                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------ |
| `packages/game` | Pure race logic, tracks, `RaceSession`, Zod protocol. No DOM, React, Three or Worker APIs. |
| `apps/web`      | React 19 + Vite. `src/kart` is the Three.js renderer, HUD and controls (lazy-loaded).      |
| `apps/worker`   | Hono Worker plus the `KartRoom` Durable Object. Serves the web build as static assets.     |

## Rules

- **One rulebook.** Every race, practice or online, runs through `RaceSession`. Do not
  add a second race loop, physics step or scoring path.
- **The room is authoritative online.** Browsers send intents. The room owns the
  roster, host, phase, race clock, places and wins. It persists before acknowledging.
  The single Durable Object alarm drives both the race tick and idle expiry.
- **Time is injected.** No `Date.now()` inside `packages/game`.
- **Original content only.** Tracks, karts and drivers are drawn in code. Do not add
  assets, names, characters or tracks from existing games, even renamed.
- **Frames, not React state.** The canvas reads the race through refs and
  `requestAnimationFrame`. Never set React state every frame.
- **Keep `three` inside `apps/web/src/kart`**, and keep the canvas behind `lazy()` so
  the home page stays light.
- British English in player-facing copy. Accessible controls. Honour reduced motion.

## Before finishing

```sh
npm run typecheck
npm test
npm run build      # when the web graph or Vite config changed
```

Never skip, `.only` or delete a failing test to get green. Fix the code or ask.
Do not deploy unless the owner asks.
