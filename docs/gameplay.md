# Gameplay & Physics Reference

Every numeric constant below comes directly from [`packages/game`](../packages/game/src/kart).

---

## 1. Driving Physics (`kart-driving.ts`)

Simulation advances in bounded **`≤ 20 ms`** steps (`stepDriving`) against a static spatial hash (`indexWalls`, `12 m` cells) using swept-circle wall contacts (`sweep`) with round segment caps.

| Parameter                          | Standard Tracks (`soloDriving`) | Party Ring (`ringDriving`) |
| :--------------------------------- | :-----------------------------: | :------------------------: |
| Reference top speed (`maxSpeed`)   |            `30 m/s`             |          `11 m/s`          |
| Reverse speed (`reverseSpeed`)     |             `8 m/s`             |          `3 m/s`           |
| Kart collision radius (`radius`)   |            `0.85 m`             |          `0.80 m`          |
| Base acceleration (`acceleration`) |            `12 m/s²`            |          `5 m/s²`          |
| Engine power (`power`)             |           `240 m²/s³`           |         `32 m²/s³`         |
| Aerodynamic drag (`drag`)          |             `0.006`             |          `0.018`           |
| Rolling resistance                 |             `0.35`              |           `0.18`           |
| Turn rate (high / low speed)       |      `1.35` / `2.40 rad/s`      |   `1.10` / `1.10 rad/s`    |

### Surface & Collision Rules

- **Off-Road Sand (`sandSlowdown`)**: Engine scales to `0.80×` with `0.30` speed drag (retains roughly 60% of road top speed) and pauses drift charging.
- **Item Slowdown (`itemSlowdown`)**: Engine scales to `0.58×` with `1.10` speed drag (`1,600 ms` duration on hit).
- **Wall Contact**: Swept bounce/slide clears active drift charge and active boost; in `bounce-v1` handling mode, hard wall impacts (`≥ 4 m/s`) add `0.22` restitution and a `180 ms` stun (`600 ms` impact cooldown).

---

## 2. Boosts, Drifts, Slipstream & Ramps

### Rocket Start (`kart.ts`)

Controls stay locked until **GO**. Your first throttle input after `goAt` is graded:

| Timing Window (since GO) |    Grade    |   Boost Tier   |  Duration  |
| :----------------------- | :---------: | :------------: | :--------: |
| `0 – 600 ms`             | **Perfect** | Tier 2 (Super) | `1,000 ms` |
| `601 – 1,200 ms`         |  **Good**   | Tier 1 (Mini)  |  `600 ms`  |
| `> 1,200 ms`             |  **Late**   |      None      |   `0 ms`   |

### 3-Tier Drift Charging (`kart-driving.ts`)

To enter a drift, hold **Drift** + **Accelerate** (without braking, off-road, or airborne) while steering (`|steer| > 0.15`) above `40%` of `maxSpeed` (`25%` to sustain). Steering _into_ the latched drift direction charges up to **`1.5×` faster**; counter-steering widens the arc without losing charge.

| Tier | Name      | Charge Threshold | Release Boost Duration | Boost Multiplier |
| :--: | :-------- | :--------------: | :--------------------: | :--------------: |
| `1`  | **Mini**  |     `700 ms`     |        `600 ms`        |       `6×`       |
| `2`  | **Super** |    `1,400 ms`    |        `900 ms`        |       `9×`       |
| `3`  | **Ultra** |    `2,400 ms`    |       `1,200 ms`       |      `12×`       |

### Slipstream Drafting (`kart-slipstream.ts`)

Karts remain ghosts to one another, so drafting is the primary pack-racing interaction:

- **Wake zone**: `2.5 m` to `16 m` behind a kart ahead, within `±2.6 m` lateral half-width, with both karts travelling `≥ 12 m/s` on aligned headings (`cos(Δθ) ≥ 0.8`).
- **Charge**: `1,000 ms` inside the wake (`"charging"` HUD cue appears at `250 ms`). Leaving the wake bleeds charge at `2×` speed.
- **Active bonus**: `1,600 ms` at `0.7×` aerodynamic drag (~**12% higher top speed**).

### Course Features (`kart-course.ts`)

- **Boost Pad**: Grants a `900 ms` Tier-2 boost (`1,000 ms` feature cooldown).
- **Glider Ramp**: Launches kart upward (`verticalSpeed = min(6, 2 + speed * 0.1)`). Holding throttle glides at `3.8` gravity; braking folds the glider to descend at `12` gravity.
- **Moving Hazard**: Smoothly oscillates `±1.5 m` laterally via `sin(courseMs / 900)`; hitting one cuts velocity to `45%` and clears active drift/boost (`1,500 ms` cooldown).

---

## 3. Track Catalogue (`kart-tracks.ts`)

| Track                | ID              | Difficulty |              Route Kind               |  Length   | Segments |      Item Boxes      | Features                        | Lap Limit |
| :------------------- | :-------------- | :--------: | :-----------------------------------: | :-------: | :------: | :------------------: | :------------------------------ | :-------: |
| **Party Ring**       | `party-ring-v1` |    Easy    | `ring` (`r = 42 m`, `34–50 m` bounds) | `263.9 m` |  `128`   | `18` (`6 × 3` lanes) | `1` boost, `1` ramp, `1` hazard |  `45 s`   |
| **Parkside**         | `parkside-v1`   |   Medium   |    `polyline` (`±12 m` half-width)    | `658.9 m` |   `72`   |         `18`         | `1` boost, `1` ramp, `1` hazard |  `180 s`  |
| **Harbour Hairpins** | `harbour-v1`    |    Hard    |    `polyline` (`±11 m` half-width)    | `946.6 m` |  `125`   | `21` (`7` stations)  | `1` boost, `1` ramp, `1` hazard |  `180 s`  |

---

## 4. Items & Projectile Engine (`kart-powers.ts`, `kart-projectiles.ts`)

Item boxes have a `2.2 m` pickup radius and an `8,000 ms` per-kart cooldown.

Every race chooses an item mode in `RaceSetup.items`: `off` (boxes never spawn), `classic` (the three items below on a fixed rotation), or `all` (the default: every item in the expanded engine with position-weighted luck).

### Classic Set

- **`turbo` (Turbo)**: `1,200 ms` boost.
- **`shield` (Bubble shield)**: `5,000 ms` shield; absorbs one oil or projectile hit.
- **`oil` (Oil slick)**: Dropped `3 m` behind the kart; persists `8,000 ms` (`750 ms` owner grace, `2 m` radius); slows victims for `1,600 ms`.

### Expanded v2 Engine (`kartItemRulesSchema`)

The `all` mode uses these seven items with position-weighted luck (`kartItemWeight`), where `standing = 0` is 1st place and `1` is last:

| Item                       | Description                                                                           | Weight Formula (`s = standing`) |
| :------------------------- | :------------------------------------------------------------------------------------ | :------------------------------ |
| **`tennis`** (Tennis ball) | Fires forward at `35 m/s`; bounces off walls up to `4` times (`6 s` life)             | `2 - 1.0·s`                     |
| **`bomb`** (Bomb)          | Drops behind (`-3 m`); arms in `500 ms`, detonates at `1,500 ms` (`6 m` blast radius) | `0.6 + 1.5·s`                   |
| **`homing`** (Homing bolt) | Locks onto target ahead via `selectKartTarget`, steers along track at `28 m/s`        | `0.3 + 3.0·s`                   |
| **`treat`** (Treats boost) | Quick `600 ms` snack boost                                                            | `1 + 1.0·s`                     |
| **`turbo`**                | `1,200 ms` turbo boost                                                                | `1 + 3.0·s`                     |
| **`shield` / `oil`**       | Defensive / trap utility                                                              | `3 - 2.4·s`                     |

---

## 5. CPU Drivers (`kart-cpu.ts`)

Up to `7` deterministic CPU drivers can fill empty grid slots (they take finishing places on the track but never accumulate room wins):

|  Slot   | Name                 | Skill Scalar |
| :-----: | :------------------- | :----------: |
| `cpu-1` | **CPU Turbo Tess**   |    `0.84`    |
| `cpu-2` | **CPU Drift Dev**    |    `0.95`    |
| `cpu-3` | **CPU Mini Max**     |    `0.88`    |
| `cpu-4` | **CPU Bonnie Boost** |    `0.92`    |
| `cpu-5` | **CPU Captain Kerb** |    `0.80`    |
| `cpu-6` | **CPU Lappy**        |    `0.90`    |
| `cpu-7` | **CPU Ziggy Zoom**   |    `0.86`    |

Each skill is multiplied by the race's CPU difficulty (`easy 0.82`, `normal 1`, `hard 1.12`). A CPU's top speed is `30 m/s × skill` on polyline tracks (`12 m/s` on the ring), times the engine class factor.

---

## 6. Modes, Classes & Records

### Engine Classes (`kart-driving.ts`)

| Class   | Speed factor | Profile change                                            |
| :------ | :----------- | :-------------------------------------------------------- |
| `50cc`  | `0.82`       | `maxSpeed` and `acceleration` × factor, `power` × factor³ |
| `100cc` | `1`          | Unchanged (absent from the race record)                   |
| `150cc` | `1.16`       | As above                                                  |

Top speed is where power meets drag, so scaling power by the cube moves top speed by the factor while grip, turning and drift rates stay the same. The room, CPU racers and on-device prediction all read the class from the race.

### Grand Prix (`grand-prix.ts`)

- Cups: **Starter Cup** (Party Ring → Parkside → Harbour Hairpins) and **Hairpin Cup** (Harbour Hairpins → Party Ring → Parkside).
- Points by finishing place: `15, 12, 10, 8, 6, 4, 2, 1`; ninth and below, and DNFs, score `0`.
- Ties on points split by most wins, then most seconds, and so on; a tie that survives every place stays tied.
- A racer who joins mid-cup shows `–` for races they missed.

### Ghosts & Records (`ghost.ts`, `apps/web/src/practice/records.ts`)

- A ghost is one `[x, z, heading]` sample per `100 ms` race tick (rounded to centimetres, up to `6,000` samples), replayed by interpolation. It never touches the race.
- Time trials (practice with `0` CPU racers) record a ghost and save it only when the run beats the stored best for that track, lap count and engine class.
- Records keep the best race time and best single lap separately, per track, lap count and engine class, in this browser's local storage.

## 7. Online Rooms (`apps/worker/src/room.ts`)

| Feature         | Rule                                                                                                                                                                             |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ready check** | Every connected racer except the host ticks ready before the host can start. A racer who has gone does not hold the race up. Readiness clears at each start.                     |
| **Rejoin**      | The room-scoped token lives in the tab's session storage. A refresh says hello with it and the racer is back in their own kart; the phone resumes from the room's rollback seed. |
| **Watching**    | Someone who joins mid-race, or has already finished, follows any kart in 3D or watches an overview. They race in the next one.                                                   |
| **Reactions**   | Eight emotes, passed to everyone and never stored. Four in a burst, then one every two seconds. Racers at the wheel see them but get no buttons.                                 |
| **Host tools**  | Remove a racer (after confirming), hand over the host to someone connected, lock the room to its roster, and list it on quick play.                                              |
| **Quick play**  | A single `RoomDirectory` Durable Object keeps listed rooms. Rooms report only when their roster, phase or access changes, and drop off after 20 minutes of silence.              |
