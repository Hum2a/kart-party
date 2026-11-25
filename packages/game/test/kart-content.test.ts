import { describe, expect, it } from "vitest";
import {
  advanceKartLap,
  beachTrack,
  cityTrack,
  createDrivingBody,
  createKartRace,
  courseFeaturePose,
  kartCups,
  kartTrackCatalogue,
  kartTrackIds,
  reduceKart,
  roundedCentreline,
  soloDriving,
  stepCourse,
  stepDriving,
  summitTrack,
  type CourseFeature,
  type DrivingSlowdown,
  type PolylineTrack,
  defaultDriverStyle,
  defaultKartPaint,
  driverStyles,
  grandPrixUnlocks,
  kartPaints,
  kartUnlocks,
  paintUnlock,
  styleUnlock,
  projectKartRace,
} from "../src/index.ts";

const fresh = [cityTrack, summitTrack, beachTrack] as const;
type Point = readonly [number, number];

function crosses(a: Point, b: Point, c: Point, d: Point) {
  const side = (p: Point, q: Point, r: Point) =>
    Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

describe("rounded centrelines", () => {
  it("rounds each corner into an arc and closes the loop at the start", () => {
    const line = roundedCentreline(
      [
        [0, 0],
        [0, -50],
        [50, -50],
        [50, 50],
        [0, 50],
      ],
      10,
    );
    expect(line[0]).toEqual([0, 0]);
    expect(line.at(-1)).toEqual([0, 0]);
    // No point sits on a sharp corner; each is at least the radius's inset away.
    for (const corner of [
      [0, -50],
      [50, -50],
      [50, 50],
      [0, 50],
    ] as const)
      expect(
        Math.min(...line.map((p) => Math.hypot(p[0] - corner[0], p[1] - corner[1]))),
      ).toBeGreaterThan(3);
    expect(() =>
      roundedCentreline(
        [
          [0, 0],
          [0, -10],
          [10, -10],
          [10, 10],
        ],
        30,
      ),
    ).toThrow(/too tight/);
  });
});

for (const track of fresh)
  describe(track.id, () => {
    it("starts on a straight heading north and never crosses itself", () => {
      expect(track.route.points[0]).toEqual([0, 0]);
      const start = track.route.point(0);
      expect(start.heading).toBeCloseTo(-Math.PI / 2);
      // A clear straight behind the line for the whole grid.
      for (let back = 0; back <= 50; back += 10)
        expect(track.route.point(-back).heading).toBeCloseTo(-Math.PI / 2);
      for (const side of ["left", "right"] as const) {
        const edge = track.ribbon.map((p) => p[side]);
        for (let i = 0; i < edge.length; i++)
          for (let j = i + 2; j < edge.length; j++) {
            if (i === 0 && j === edge.length - 1) continue;
            const a = edge[i]!,
              b = edge[(i + 1) % edge.length]!,
              c = edge[j]!,
              d = edge[(j + 1) % edge.length]!;
            expect(crosses(a, b, c, d), `${side} ${i}/${j}`).toBe(false);
          }
      }
    });

    it("keeps every branch apart from the main road between its two ends", () => {
      for (const branch of track.branches) {
        const middle = branch.points
          .slice(0, -1)
          .flatMap((p, i) => {
            const q = branch.points[i + 1]!;
            return Array.from({ length: 20 }, (_, k): Point => [
              p[0] + ((q[0] - p[0]) * k) / 20,
              p[1] + ((q[1] - p[1]) * k) / 20,
            ]);
          })
          .filter((_, i, all) => i > all.length * 0.4 && i < all.length * 0.6);
        for (const [x, z] of middle)
          expect(track.surfaceAt(x, z), `${branch.id} ${x},${z}`).toBe(branch.surface);
      }
    });

    it("counts a lap driven through each branch, gate by gate", () => {
      for (const branch of track.branches) {
        const route = track.route;
        // Main road to the branch, the branch itself, then main road home.
        const path: Point[] = [];
        for (let along = 0; along < branch.fromAlong; along += 0.4) {
          const p = route.point(along);
          path.push([p.x, p.z]);
        }
        const [first, ...rest] = branch.points;
        let previous = first!;
        for (const point of rest) {
          const length = Math.hypot(point[0] - previous[0], point[1] - previous[1]);
          for (let d = 0; d < length; d += 0.4)
            path.push([
              previous[0] + ((point[0] - previous[0]) * d) / length,
              previous[1] + ((point[1] - previous[1]) * d) / length,
            ]);
          previous = point;
        }
        for (let along = branch.toAlong; along <= route.lapLength + 2; along += 0.4) {
          const p = route.point(along);
          path.push([p.x, p.z]);
        }
        let cursor = { angle: 0, distance: 0, checkpoint: 0 };
        let finished = false;
        for (const [x, z] of path) {
          const projection = route.progress(x, z);
          const step = advanceKartLap(cursor, {
            along: projection.along,
            lapLength: route.lapLength,
            speed: 20,
            stepMs: 20,
            routeDistance: projection.distance,
          });
          expect(step.safeProgress, `${branch.id} at ${x},${z}`).toBe(true);
          cursor = step;
          finished ||= step.finished;
        }
        expect(cursor.checkpoint).toBe(8);
        expect(finished).toBe(true);
      }
    });

    it("lets CPU racers finish a lap on their own", () => {
      let race = createKartRace("r", [{ playerId: "a", name: "Amina" }], {
        trackId: track.id as (typeof kartTrackIds)[number],
        seedGrid: true,
        cpu: 3,
      });
      for (let t = 200; t <= 90_000 && !race.ended; t += 200)
        race = reduceKart(race, { type: "tick", elapsedMs: t });
      for (const cpu of race.drivers.filter((d) => d.cpu))
        expect(cpu.status, cpu.name).toBe("FINISHED");
    });
  });

/** Seconds to cover each stretch in turn from 25 m/s, holding the throttle. */
function runTime(
  stretches: readonly { metres: number; ground: DrivingSlowdown }[],
  boostMs = 0,
) {
  let body = { ...createDrivingBody(0, 0, 0), vx: 25 };
  body.boostMs = boostMs;
  let ms = 0,
    covered = 0;
  for (const stretch of stretches) {
    covered += stretch.metres;
    while (body.x < covered) {
      body = stepDriving(
        body,
        { steer: 0, gas: true, brake: false, drift: false },
        10,
        soloDriving,
        [],
        stretch.ground,
      );
      ms += 10;
      if (ms > 60_000) throw new Error("Never arrived");
    }
  }
  return ms / 1000;
}

describe("shortcuts", () => {
  const shortcuts = fresh.flatMap((track) =>
    track.branches.filter((b) => b.kind === "shortcut").map((b) => ({ track, b })),
  );
  it("exist on the city and the mountain", () => {
    expect(shortcuts.map((s) => s.b.id).sort()).toEqual([
      "city-v1-site",
      "summit-v1-goat",
    ]);
  });

  for (const { track, b } of shortcuts)
    it(`${b.id}: bogs down without a boost, pays off with one`, () => {
      const gravel = measure(track, b);
      const main = b.toAlong - b.fromAlong;
      // Both runs carry on 40 m past the junction, so a slow exit costs time too.
      const viaMain = runTime([{ metres: main + 40, ground: false }]);
      const viaShortcut = (boost: number) =>
        runTime(
          [
            { metres: gravel.before, ground: false },
            { metres: gravel.metres, ground: "gravel" },
            { metres: gravel.after + 40, ground: false },
          ],
          boost,
        );
      expect(viaShortcut(0)).toBeGreaterThan(viaMain);
      // A Turbo item (1.2 s) or a full drift boost carries a kart across.
      expect(viaShortcut(1200)).toBeLessThan(viaMain);
      expect(gravel.metres).toBeGreaterThan(15);
    });

  it("is never the only way round: an alternate route is road", () => {
    const boardwalk = beachTrack.branches.find((b) => b.kind === "alternate")!;
    expect(boardwalk.surface).toBe("road");
    expect(boardwalk.halfWidth).toBeLessThan(beachTrack.halfWidth / 2);
    // Shorter than the headland, but narrow and guarded by a moving hazard.
    expect(boardwalk.length).toBeLessThan(boardwalk.toAlong - boardwalk.fromAlong);
    expect(
      beachTrack.course.some(
        (f) =>
          f.kind === "hazard" &&
          beachTrack.surfaceAt(f.x, f.z) === "road" &&
          Math.abs(f.z - boardwalk.points[0]![1]) < 1,
      ),
    ).toBe(true);
  });
});

/** How much of a branch is gravel, and the road either side of it. */
function measure(track: PolylineTrack, branch: PolylineTrack["branches"][number]) {
  const [a, b] = [branch.points[0]!, branch.points.at(-1)!];
  let before = 0,
    metres = 0,
    after = 0;
  const steps = Math.ceil(branch.length * 4);
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps,
      x = a[0] + (b[0] - a[0]) * t,
      z = a[1] + (b[1] - a[1]) * t;
    const step = branch.length / steps;
    if (track.surfaceAt(x, z) === "gravel") metres += step;
    else if (metres === 0) before += step;
    else after += step;
  }
  return { before, metres, after };
}

describe("course features", () => {
  const feature = (extra: Partial<CourseFeature>): CourseFeature => ({
    id: "f",
    kind: "boost",
    x: 0,
    z: 0,
    heading: 0,
    width: 4,
    length: 5,
    ...extra,
  });
  const gas = { steer: 0, gas: true, brake: false, drift: false };
  const moving = (x: number) => ({ ...createDrivingBody(x, 0, 0), vx: 20 });

  it("keeps topping up the boost along a boost lane", () => {
    const lane = feature({ length: 20 });
    let body = moving(-9);
    const boosts: number[] = [];
    for (let i = 0; i < 50; i++) {
      const next = { ...body, x: body.x + 0.4 };
      body = stepCourse(body, next, gas, 20, [lane], 0.85);
      if (body.trackNotice === "boost") boosts.push(i);
      body.trackNotice = undefined;
    }
    // A short pad boosts once a second; a lane fires again every 300 ms.
    expect(boosts.length).toBeGreaterThan(1);
    const pad = feature({ length: 5 });
    body = moving(-3);
    let padBoosts = 0;
    for (let i = 0; i < 20; i++) {
      const next = { ...body, x: body.x + 0.4 };
      body = stepCourse(body, next, gas, 20, [pad], 0.85);
      if (body.trackNotice === "boost") padBoosts++;
      body.trackNotice = undefined;
    }
    expect(padBoosts).toBe(1);
  });

  it("throws a kart higher off a jump pad than off a ramp", () => {
    const launch = (lift?: number) =>
      stepCourse(
        moving(-1),
        moving(0),
        gas,
        20,
        [feature({ kind: "ramp", ...(lift ? { lift } : {}) })],
        0.85,
      ).verticalSpeed ?? 0;
    expect(launch()).toBeGreaterThan(0);
    expect(launch(1.6)).toBeCloseTo(launch() * 1.6);
  });

  it("swings a moving hazard as far and as slowly as its track says", () => {
    const boulder = feature({ kind: "hazard", sway: 6, swayMs: 1700 });
    const reach = Math.max(
      ...Array.from({ length: 400 }, (_, i) =>
        Math.abs(courseFeaturePose(boulder, i * 50).z),
      ),
    );
    expect(reach).toBeGreaterThan(5.9);
    expect(reach).toBeLessThanOrEqual(6);
    // The original hazards still move 1.5 m.
    const old = feature({ kind: "hazard" });
    expect(Math.abs(courseFeaturePose(old, (Math.PI / 2) * 900).z)).toBeCloseTo(1.5);
  });

  it("narrows the summit road to a bridge", () => {
    const bridge = summitTrack.narrows.find((n) => n.bridge)!;
    expect(bridge).toBeTruthy();
    const middle = (bridge.from + bridge.to) / 2;
    expect(summitTrack.halfWidthAt(middle)).toBe(5);
    expect(summitTrack.halfWidthAt(0)).toBe(summitTrack.halfWidth);
    const centre = summitTrack.lanePoint(middle);
    expect(summitTrack.surfaceAt(centre.x + 7, centre.z)).toBe("dirt");
    expect(summitTrack.surfaceAt(centre.x + 4, centre.z)).toBe("road");
  });
});

describe("catalogue and cups", () => {
  it("lists six original tracks, each new one with its own character", () => {
    expect(kartTrackCatalogue).toHaveLength(6);
    const byId = Object.fromEntries(kartTrackCatalogue.map((t) => [t.id, t]));
    expect(byId["city-v1"]!.features).toMatchObject({ shortcuts: 1, hazards: 3 });
    expect(byId["summit-v1"]!.features).toMatchObject({ bridges: 1, shortcuts: 1 });
    expect(byId["beach-v1"]!.features).toMatchObject({ alternates: 1, boosts: 3 });
    expect(byId["beach-v1"]!.route.metres).toBeGreaterThan(
      Math.max(
        ...kartTrackCatalogue
          .filter((t) => t.id !== "beach-v1")
          .map((t) => t.route.metres),
      ),
    );
  });

  it("puts every track in a cup, and all six in the Grand Tour", () => {
    const used = new Set(kartCups.flatMap((cup) => cup.tracks));
    expect([...used].sort()).toEqual([...kartTrackIds].sort());
    const tour = kartCups.find((cup) => cup.id === "grand-tour")!;
    expect([...tour.tracks].sort()).toEqual([...kartTrackIds].sort());
  });
});

describe("cosmetic unlocks", () => {
  it("earns more for a better Grand Prix, and the best only on the Grand Tour", () => {
    expect(grandPrixUnlocks({ cupId: "starter-cup", place: undefined })).toEqual([]);
    expect(grandPrixUnlocks({ cupId: "starter-cup", place: 6 })).toEqual([
      "paint-copper",
    ]);
    expect(grandPrixUnlocks({ cupId: "starter-cup", place: 3 })).toEqual([
      "paint-copper",
      "paint-racing",
      "style-astronaut",
    ]);
    expect(grandPrixUnlocks({ cupId: "neon-cup", place: 1 })).not.toContain(
      "style-champion",
    );
    expect(grandPrixUnlocks({ cupId: "grand-tour", place: 1 })).toEqual(
      kartUnlocks.map((u) => u.id),
    );
    expect(grandPrixUnlocks({ cupId: "grand-tour", place: 0 })).toEqual([]);
  });

  it("locks only the new paints and drivers, and never gives them out by default", () => {
    const lockedPaints = kartPaints.filter((p) => paintUnlock(p.id)).map((p) => p.id);
    const lockedStyles = driverStyles.filter((s) => styleUnlock(s.id)).map((s) => s.id);
    expect(lockedPaints).toEqual(["copper", "racing", "gold"]);
    expect(lockedStyles).toEqual(["astronaut", "champion"]);
    for (let order = 0; order < 40; order++) {
      expect(lockedPaints).not.toContain(defaultKartPaint(order));
      expect(lockedStyles).not.toContain(defaultDriverStyle(order));
    }
    // Every unlock names a real item.
    for (const unlock of kartUnlocks)
      expect(
        unlock.kind === "paint"
          ? kartPaints.some((p) => p.id === unlock.item)
          : driverStyles.some((s) => s.id === unlock.item),
      ).toBe(true);
  });
});

describe("race views", () => {
  for (const trackId of kartTrackIds)
    it(`${trackId}: a full race with items projects into a valid view`, () => {
      const race = createKartRace("view", [{ playerId: "a", name: "Amina" }], {
        trackId,
        seedGrid: true,
        cpu: 7,
        itemRules: { version: 1 },
      });
      const ticked = reduceKart(race, { type: "tick", elapsedMs: 1_000 });
      const view = projectKartRace(ticked, "a", 1_000);
      expect(view.trackId).toBe(trackId);
      expect(view.powers?.boxes.length ?? 0).toBeLessThanOrEqual(24);
    });
});
