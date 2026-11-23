# Kart Party

A browser kart racer. Drift, boost and throw items on three original tracks, on your
own against CPU drivers or online with up to eight friends, each on their own phone
or computer.

Planned home: **https://kart.humza.website**

## What is in it

- **Three original tracks**: Party Ring (easy), Parkside (medium) and Harbour
  Hairpins (hard). Every track, kart and driver is drawn in code. There are no
  downloaded models.
- **Practice**: one to three laps, zero to seven CPU racers, items on or off. Your
  personal best for each track and lap count is saved in this browser.
- **Online rooms**: create a room, share the four-letter code or link, and the host
  picks the track, laps, CPU racers and items. A room holds up to eight people.
  Wins are counted for each racer in the room.
- **Controls**: keyboard (arrows or WASD, Space to drift, E for your item, R to get
  back on the track), touch controls on phones, and gamepads.
- Drift charging with three boost tiers, slipstream, rocket starts, item boxes
  (shield, turbo, oil, thrown items), boost pads, ramps and hazards.

## How it works

```
packages/game   Pure TypeScript: race reducer, physics, tracks, items, CPU drivers,
                RaceSession, and the Zod wire protocol. No DOM, no Worker APIs.
apps/web        React 19 + Vite. Three.js renderer (lazy-loaded), HUD, touch,
                keyboard and gamepad controls, practice and online screens.
apps/worker     Hono on Cloudflare Workers, plus one Durable Object (KartRoom) per
                online room. The same Worker serves the built web app.
```

- **One set of rules.** Practice and online rooms both run a race through
  `RaceSession` in `packages/game`. In practice it runs in the browser. Online it
  runs in the room's Durable Object.
- **The room is authoritative.** Browsers send controls and intents. The room
  steps the race ten times a second, owns the roster, host, phases, places and
  wins, and saves to its SQLite-backed storage before acknowledging anything.
- **Device-timed finishes.** Each racer's own kart is drawn from local
  prediction, so steering feels instant. The browser reports its finish time and
  lap splits. The room checks identity, race and lap count before accepting.
- **Identity** is a random token scoped to one room, kept in the tab's session
  storage. Refreshing rejoins as the same racer, and a second tab joins as someone
  new. There are no accounts and no device fingerprints.
- Rooms nobody has used for six hours delete themselves.

## Getting started

Requires Node 22.12 or newer and npm.

```sh
npm install
npm run dev          # http://localhost:5180, with the Worker and rooms running locally
```

The dev server runs the real Worker and Durable Object in `workerd`, so online rooms
work locally. Open a second browser tab to join your own room.

## Checks

```sh
npm run typecheck    # all workspaces
npm test             # game logic, web components and the room (Workers runtime)
npm run build        # production web build plus the Worker bundle
```

## Deploying

The Worker config is `apps/worker/wrangler.jsonc`. Its `production` environment
serves `kart.humza.website` as a custom domain, which must be a zone on the same
Cloudflare account.

```sh
npx wrangler login
npm run deploy       # builds, then deploys the production environment
```

## Provenance

The race logic, track geometry, renderer and controls started life as the kart
mini-game in a private birthday-party project by the same author. The kart
handling model credits an MIT-licensed open-source kart controller. That notice is
kept in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). None of that project's
track, kart model or other art is used here.
