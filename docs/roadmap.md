# Kart Party roadmap

The goal is a complete kart racer: everything the open-source Mario Kart .js projects
had (mustache-dev/Mario-Kart-3.js and its fork Nathan-Richard-21/mario-kart-js), done
properly, plus the modes, polish and online features that make it a whole game.

Kart Party stays an original game. Its mechanics are the genre's, but its look, names
and content are its own.

## Never carried over

These were in the upstream projects but belong to Nintendo or to unclear sources:

- The Mario circuit model, the kart and witch models, and the wheel model.
- The Mario Kart font, the SNES and wallpaper images, and the Mario Kart Wii soundtrack.
- Any Nintendo character, item or track name, such as "red shell" or "banana".

The replacements are original:

- Tracks and karts are procedural, drawn in code.
- Items have their own names: Bubble shield, Homing bolt, Tennis ball, Bomb, Oil slick, Turbo and Treats.
- Music and sound effects are synthesised in code.

## Every upstream feature and where Kart Party stands

Status key:

- **Done**: shipped and switched on.
- **Built**: the code exists and is tested, but it is not switched on yet.
- **Planned**: listed in a phase below.
- **Not carried**: deliberately left out (see above).

| ID  | Upstream feature                               | Kart Party                                                                               | Phase |
| --- | ---------------------------------------------- | ---------------------------------------------------------------------------------------- | ----- |
| K01 | Circuit and kart models                        | Original procedural tracks and karts. Upstream models not carried                        | done  |
| K02 | Wheel spin, steering, ground-following chassis | Done: procedural kart roll and steering pose                                             | done  |
| K03 | Animated driver variants                       | Done: six driver styles with lean, look-back and wave                                    | done  |
| K04 | Hop, lean and slip pose                        | Done                                                                                     | done  |
| K05 | Drift charge, three boost tiers                | Done, room-authoritative                                                                 | done  |
| K06 | Chase camera with boost response               | Done                                                                                     | done  |
| K07 | Dirt and tyre dust                             | Built; switch on                                                                         | 1     |
| K08 | Exhaust smoke                                  | Built; switch on                                                                         | 1     |
| K09 | Drift sparks and glow bursts                   | Sparks done; glow bursts built                                                           | 1     |
| K10 | Rear-wheel glow                                | Built; switch on                                                                         | 1     |
| K11 | Drift arcs                                     | Built; switch on                                                                         | 1     |
| K12 | Boost trails                                   | Built; switch on                                                                         | 1     |
| K13 | Boost flames                                   | Built; switch on                                                                         | 1     |
| K14 | Skid marks                                     | Planned: pooled, surface-aligned, time-limited                                           | 5     |
| K15 | Confetti                                       | Built; switch on for finishes and podium                                                 | 1     |
| K16 | Shared VFX emitter                             | Done (bounded, pooled)                                                                   | done  |
| K17 | VFX authoring bench                            | Planned as a dev-only page                                                               | 7     |
| K18 | Gradient sky, sun, horizon                     | Built in the look presets; switch on                                                     | 1     |
| K19 | Environment lighting                           | Built in the look presets; switch on                                                     | 1     |
| K20 | Following shadows                              | Planned, quality-gated                                                                   | 5     |
| K21 | Colour grading                                 | Built; switch on                                                                         | 1     |
| K22 | Boost wind lines, chromatic response           | Built; switch on at higher graphics                                                      | 1     |
| K23 | Lens dirt                                      | Built; off by default                                                                    | 1     |
| K24 | Bloom                                          | Built; quality-gated                                                                     | 1     |
| K25 | AO and tilt-shift                              | Built; off by default                                                                    | 1     |
| K26 | Static scenery collision                       | Done (swept walls)                                                                       | done  |
| K27 | Collision bounce and stun                      | Done (bounce profile)                                                                    | done  |
| K28 | Touch steering and buttons                     | Done                                                                                     | done  |
| K29 | Keyboard and gamepad                           | Done                                                                                     | done  |
| K30 | Mouse steering                                 | Done (opt-in)                                                                            | done  |
| K31 | Item and recovery shortcuts                    | Done (E, R, X, Y)                                                                        | done  |
| K32 | Loading, progress, retry                       | Done                                                                                     | done  |
| K33 | Ready check and 3-2-1-GO                       | Countdown done; ready check planned                                                      | 4     |
| K34 | Race HUD and results                           | Done; podium screen planned                                                              | 5     |
| K35 | Time-trial mode                                | Done: time trial (no CPUs) races your saved ghost with lap splits                        | done  |
| K36 | Best laps and records                          | Done: best race and best lap per track, laps and engine class; ghost saved on a new best | done  |
| K37 | Minimap and navigation                         | Done                                                                                     | done  |
| K38 | Multiplayer with visible opponents             | Done (rooms of 8, nearby karts)                                                          | done  |
| K39 | Spectator cameras                              | Planned: 3D follow and overview for spectators                                           | 4     |
| K40 | Item boxes, turbo, shield, oil                 | Done                                                                                     | done  |
| K41 | Tennis-ball projectile                         | Built; switch on                                                                         | 1     |
| K42 | Bomb                                           | Built; switch on                                                                         | 1     |
| K43 | Homing projectile                              | Built (Homing bolt); switch on                                                           | 1     |
| K44 | Treats                                         | Built (Treats boost); switch on                                                          | 1     |
| K45 | More tracks                                    | Three originals; more planned                                                            | 6     |
| K46 | Mode menus, tutorial, controls help            | Menus done; tutorial planned                                                             | 5     |
| K47 | Sound effects and music                        | Engine note and chimes done; full SFX and music planned                                  | 3     |
| K48 | Installable, offline practice                  | Planned (PWA, practice only)                                                             | 5     |
| K49 | Preload, performance, lifecycle                | Done (adaptive graphics, lazy engine)                                                    | done  |
| K50 | Debug tools                                    | Planned as dev-only overlays                                                             | 7     |
| K51 | Dependencies and attribution                   | Done (notices kept)                                                                      | done  |

## Phases

### Phase 1: switch on what is built (done)

- Effects on by default: dust, exhaust, glow, arcs, trails, flames, confetti. The
  graphics setting still scales them down on slow devices.
- A real sky and lighting look ("daylight" with tone mapping) instead of the flat
  colour. Bloom, wind lines and chromatic response only at higher graphics settings.
- All seven items: Turbo, Bubble shield, Oil slick, Tennis ball, Bomb, Homing bolt
  and Treats. Item boxes favour catch-up items for racers at the back. Setup offers
  items **off**, **classic** (turbo, shield, oil) or **all**.
- CPU difficulty: easy, normal or hard.
- Kart paint: each racer picks one of eight colours, shown on their kart and badge.

### Phase 2: modes (done)

- **Grand Prix**: three or more races in a row with points (15, 12, 10, 8, 6, 4, 2,
  1), a running table between races and a final podium. Solo against CPUs, and
  online for rooms.
- **Time trial**: a dedicated mode with a three-lap run, a best-lap split, and a
  **ghost**. The race is deterministic, so a ghost is just your input log replayed
  through the same reducer. The best ghost per track is kept in this browser.
- **Engine classes**: 50, 100 and 150 speed classes that scale top speed and CPU pace.

### Phase 3: sound

- Original synthesised music per track and for the menus. No samples.
- Effects: drift charge and release, each boost tier, item box, each item use and
  hit, wall bump, lap, final lap, countdown, finish and podium fanfare.
- Separate music and effects volume, plus mute, remembered per browser.

### Phase 4: online

- Ready check before the countdown.
- Rejoin a running race after a refresh or a dropped connection.
- Spectators and late joiners watch in 3D (follow any racer, or an overview), then
  join the next race.
- Emotes and quick reactions in the lobby and during the race.
- The host can kick a player, transfer host, and lock the room.
- Room link QR code for phones.
- An optional public quick-play list of open rooms.

### Phase 5: presentation

- Podium scene with confetti and the top three karts.
- Skid marks (K14) and quality-gated shadows (K20).
- First-run tutorial ("driving school") covering accelerating, drifting, boosting,
  items and recovery, each as a short guided step.
- A settings page: graphics, audio, controls (remap keys, steering sensitivity,
  swap touch sides), camera distance, reduced motion, and colour-blind-safe kart paint.
- Installable app (PWA) that can play practice offline.

### Phase 6: content

- At least three more original tracks, each with a strong identity: tight city
  blocks, a mountain switchback with ramps, and a long beach loop with boost lanes.
- Shortcuts that need a boost or a Treat to make, and alternate routes.
- More course features: boost lanes, jump pads, moving hazards and narrow bridges.
- Cosmetic unlocks earned from Grand Prix results: new paints and driver styles.

### Phase 7: depth and tooling

- Kart-to-kart bumping with a weight stat, room-authoritative and deterministic.
- Global time-trial leaderboards per track, checked against plausible lap times and
  replayed from the submitted ghost before acceptance.
- Dev-only VFX bench (K17) and physics and collision overlays (K50).
- Local stats and achievements: races, wins, drifts, items landed and best times.
