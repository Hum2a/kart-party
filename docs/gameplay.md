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
- **Shortcut Gravel (`gravelSlowdown`)**: Engine scales to `0.55×` with `1.00` speed drag, so an unboosted kart bogs down to about a quarter of road speed. A boost multiplies the engine as usual, so a Turbo, a Treat or a drift boost carries a kart across at speed. `surfaceSlowdown` maps the ground (road, dirt or gravel) to the right slowdown for both the room and the phone's prediction.
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
- **Boost Lane**: A boost pad longer than `8 m` (`boostLaneLength`). Its cooldown is `300 ms`, so it keeps topping the boost up while you stay on it.
- **Glider Ramp**: Launches kart upward (`verticalSpeed = min(6, 2 + speed * 0.1)`). Holding throttle glides at `3.8` gravity; braking folds the glider to descend at `12` gravity.
- **Jump Pad**: A ramp with a `lift` above `1`; launch speed and its cap both scale by `lift` (the summit's pad is `1.6`).
- **Moving Hazard**: Smoothly oscillates laterally via `sin(courseMs / swayMs) × sway` (default `±1.5 m`, `900`; the city barriers and summit boulders swing `±6 m`); hitting one cuts velocity to `45%` and clears active drift/boost (`1,500 ms` cooldown).

---

## 3. Track Catalogue (`kart-tracks.ts`)

| Track                 | ID              | Difficulty |              Route Kind               |   Length   | Segments |      Item Boxes      | Features                                                     | Lap Limit |
| :-------------------- | :-------------- | :--------: | :-----------------------------------: | :--------: | :------: | :------------------: | :----------------------------------------------------------- | :-------: |
| **Party Ring**        | `party-ring-v1` |    Easy    | `ring` (`r = 42 m`, `34–50 m` bounds) | `263.9 m`  |  `128`   | `18` (`6 × 3` lanes) | `1` boost, `1` ramp, `1` hazard                              |  `45 s`   |
| **Parkside**          | `parkside-v1`   |   Medium   |    `polyline` (`±12 m` half-width)    | `658.9 m`  |   `72`   |         `18`         | `1` boost, `1` ramp, `1` hazard                              |  `180 s`  |
| **Harbour Hairpins**  | `harbour-v1`    |    Hard    |    `polyline` (`±11 m` half-width)    | `946.6 m`  |  `125`   | `21` (`7` stations)  | `1` boost, `1` ramp, `1` hazard                              |  `180 s`  |
| **Neon Blocks**       | `city-v1`       |    Hard    |    `polyline` (`±10 m` half-width)    | `822.5 m`  |  `111`   | `21` (`7` stations)  | `2` boosts, `1` ramp, `3` sliding barriers, shortcut         |  `180 s`  |
| **Summit Switchback** | `summit-v1`     |    Hard    |  `polyline` (`±10 m`, bridge `±5 m`)  | `918.0 m`  |  `256`   |         `18`         | `2` boosts, `2` jump pads, `2` boulders, bridge, shortcut    |  `180 s`  |
| **Sunset Strand**     | `beach-v1`      |    Easy    |    `polyline` (`±12 m` half-width)    | `1143.1 m` |  `153`   | `24` (`8` stations)  | `3` boost lanes, `1` dune jump, `2` hazards, alternate route |  `180 s`  |

The new courses are built from corner points by `roundedCentreline` (each corner becomes an arc of its radius), so a layout reads like a street plan.

### Shortcuts and Alternate Routes (`kart-polyline.ts`)

A branch is a second way between two points on the lap, with its own walls; the main barrier opens where it leaves and rejoins.

- **Shortcut** (gravel): **Building site** on Neon Blocks (`56.6 m` instead of `72.2 m` of road) and **Goat track** on Summit Switchback (`63.6 m` instead of `82.2 m`). Without a boost the gravel bogs you down and the road is quicker; with a Turbo, a Treat or a drift boost the shortcut wins. A test drives both lines to prove it.
- **Alternate route** (road): the **Boardwalk** across the bay on Sunset Strand, `215 m` against `287 m` round the headland. It is narrow and has a crab on it; the headland has a boost lane.
- **Lap progress**: a branch maps its own length onto the stretch of lap it replaces, and eases from the main road's reading over `8 m` as a kart leaves the road, so the ordered lap gates accept a branch exactly as they accept the road. CPU racers keep to the main road.
- **Item boxes**: the race view carries at most `24`, so no course may have more.

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

- Cups: **Starter Cup** (Party Ring → Parkside → Harbour Hairpins), **Hairpin Cup** (Harbour Hairpins → Party Ring → Parkside), **Coast Cup** (Sunset Strand → Parkside → Summit Switchback), **Neon Cup** (Neon Blocks → Summit Switchback → Harbour Hairpins) and the six-race **Grand Tour** (every track).
- Points by finishing place: `15, 12, 10, 8, 6, 4, 2, 1`; ninth and below, and DNFs, score `0`.
- Ties on points split by most wins, then most seconds, and so on; a tie that survives every place stays tied.
- A racer who joins mid-cup shows `–` for races they missed.

### Cosmetic Unlocks (`kart-unlocks.ts`, `apps/web/src/unlocks`)

Finishing a Grand Prix earns paints and drivers. They change how a kart looks and nothing else.

| Unlock                               | How                                  |
| :----------------------------------- | :----------------------------------- |
| Copper paint                         | Finish any Grand Prix                |
| Racing green paint, Astronaut driver | Finish a Grand Prix in the top three |
| Gold paint                           | Win a Grand Prix                     |
| Champion driver                      | Win the Grand Tour                   |

Unlocks are kept on the device that earned them (`kart-party-unlocks` in local storage), like the settings. There are no accounts, so the room accepts any paint or driver a phone sends; the pickers simply show locked ones greyed out with how to earn them, and racers who have not chosen are only ever given the starter paints and drivers. The final results show what a Grand Prix newly unlocked, and the settings page lists them all.

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

## 8. Driving School and Settings

### Driving School (`apps/web/src/practice/school.ts`)

Six short steps on the Party Ring at 50cc, with items on and no other karts. Each step
watches the race view and moves on when the racer has done it. Nothing in the school
is saved as a best time or ghost.

| Step              | Done when                                                   |
| :---------------- | :---------------------------------------------------------- |
| Accelerate        | 0.8 s at 6 m/s or more (about two thirds of 50cc top speed) |
| Steer             | Steered at least 40% left and 40% right while moving        |
| Drift             | The drift gauge fills its first bar                         |
| Boost             | A boost is running (let go of a charged drift)              |
| Use an item       | The race accepted an item use                               |
| Back on the track | The race accepted a recovery                                |

Any step can be skipped. Finishing or leaving marks the school as done, and the home
page stops suggesting it.

### Settings (`apps/web/src/settings/settings.ts`)

Saved in this browser's local storage, checked on every read, and shared live between
open tabs.

| Setting                 | Choices                                                                                |
| :---------------------- | :------------------------------------------------------------------------------------- |
| Detail                  | Auto (adjusts to frame health), High, Low                                              |
| Kart shadows            | Auto (off at low detail), On, Off                                                      |
| Camera                  | Close, Normal, Far (scales the chase camera's distance and height)                     |
| Touch steering          | Auto, thumb pad or slider; swap sides; steering response; gamepad deadzone; mouse area |
| Keyboard                | Two keys per action. A key already in use moves; an action it leaves empty swaps keys  |
| Motion                  | Follow my device, or always reduce                                                     |
| Colour-blind-safe paint | Draws paints from the Okabe–Ito set on this device only; names stay the same           |
