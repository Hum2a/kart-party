import { describe, expect, it } from "vitest";
import {
  RaceSession,
  classProfile,
  createDrivingBody,
  createKartRace,
  kartPoseTuning,
  polylineTrack,
  reduceKart,
  soloDriving,
  stepDriving,
  surfaceSlowdown,
  type DrivingBody,
  type KartPoseReport,
  type KartRace,
} from "../src/index.ts";

const controls = { steer: 0, gas: true, brake: false, drift: false };

/** A phone-timed race with one kart placed at a point on the course. */
function placed(
  trackId: "summit-v1" | "city-v1",
  x: number,
  z: number,
  heading: number,
) {
  const race = structuredClone({
    ...createKartRace("pose", [{ playerId: "p", name: "P" }], {
      trackId,
      seedGrid: true,
    }),
    timingMode: "device-v1" as const,
  }) as KartRace;
  const kart = race.drivers[0]!;
  const course = polylineTrack(trackId)!;
  const projection = course.route.progress(x, z);
  Object.assign(kart, {
    x,
    z,
    heading,
    angle: projection.along,
    distance: projection.along,
    checkpoint: Math.floor((projection.along / course.route.lapLength) * 8),
    physics: { ...createDrivingBody(x, z, heading), vx: 0, vz: -20 },
  });
  return { race: { ...race, elapsedMs: 10_000 }, course };
}

const report = (race: KartRace, pose: KartPoseReport, sequence = 1) =>
  reduceKart(race, {
    type: "input",
    playerId: "p",
    value: { raceId: race.raceId, sequence, ...controls, pose },
  });

describe("pose reports", () => {
  it("moves the room's copy to where the phone says, when it could have got there", () => {
    const { race } = placed("summit-v1", 0, -60, -Math.PI / 2);
    const next = report(race, {
      at: 10_050,
      x: 0.4,
      z: -63,
      heading: -Math.PI / 2,
      vx: 0,
      vz: -25,
    });
    const kart = next.drivers[0]!;
    expect([kart.x, kart.z]).toEqual([0.4, -63]);
    expect(kart.physics).toMatchObject({ x: 0.4, z: -63, vz: -25 });
    expect(kart.speed).toBeCloseTo(25);
  });

  it("refuses a report through a wall, too fast, out of order, or off the course", () => {
    const { race } = placed("summit-v1", 0, -80, -Math.PI / 2);
    const pose = { heading: Math.PI / 2, vx: 0, vz: 20 };
    // The next leg of the switchback, 40 m away behind the barriers.
    expect(report(race, { at: 11_000, x: 40, z: -80, ...pose }).drivers[0]!.x).toBe(0);
    // 100 m up the same leg in half a second.
    expect(report(race, { at: 10_500, x: 0, z: -180, ...pose }).drivers[0]!.z).toBe(
      -80,
    );
    // Far from the race clock.
    expect(
      report(race, {
        at: 10_000 + kartPoseTuning.windowMs + 100,
        x: 0,
        z: -82,
        ...pose,
      }).drivers[0]!.z,
    ).toBe(-80);
    // In the field beside the road.
    expect(report(race, { at: 10_100, x: -25, z: -80, ...pose }).drivers[0]!.x).toBe(0);
    // Accepted once, then an older report cannot pull it back.
    const first = report(race, { at: 10_100, x: 0, z: -82, ...pose });
    expect(first.drivers[0]!.z).toBe(-82);
    const older = report(first, { at: 10_050, x: 0, z: -81, ...pose }, 2);
    expect(older.drivers[0]!.z).toBe(-82);
  });

  it("leaves server-timed races alone", () => {
    const { race } = placed("summit-v1", 0, -60, -Math.PI / 2);
    const legacy = { ...race, timingMode: undefined };
    const next = report(legacy, {
      at: 10_050,
      x: 0,
      z: -62,
      heading: -Math.PI / 2,
      vx: 0,
      vz: -20,
    });
    expect(next.drivers[0]!.z).toBe(-60);
  });

  it("counts a gate the jump passes over", () => {
    const { race, course } = placed("city-v1", 0, -40, -Math.PI / 2);
    const gate = course.route.lapLength / 8;
    const before = course.route.point(gate - 2),
      after = course.route.point(gate + 3);
    const kart = race.drivers[0]!;
    Object.assign(kart, {
      x: before.x,
      z: before.z,
      angle: gate - 2,
      distance: gate - 2,
      checkpoint: 0,
    });
    const next = report(race, {
      at: 10_100,
      x: after.x,
      z: after.z,
      heading: after.heading,
      vx: Math.cos(after.heading) * 25,
      vz: Math.sin(after.heading) * 25,
    });
    expect(next.drivers[0]!.checkpoint).toBe(1);
  });
});

/**
 * A phone and the room side by side: the phone steps its own kart every 20 ms
 * with its controls as they happen (as the phone's prediction does); the room
 * hears the controls only every 100 ms. An autopilot steers by the phone's kart
 * round Neon Blocks, through the building-site shortcut.
 */
function drive(withPose: boolean) {
  const course = polylineTrack("city-v1")!;
  const session = RaceSession.create({
    raceId: "side-by-side",
    players: [{ playerId: "p", name: "P" }],
    trackId: "city-v1",
    laps: 1,
    cpu: 0,
  } as never);
  expect(session.race.timingMode).toBe("device-v1");
  const start = session.race.drivers[0]!;
  let phone: DrivingBody = createDrivingBody(start.x, start.z, start.heading);
  const profile = classProfile(soloDriving, session.race.speedClass);
  const path = [
    [0, -84],
    [16, -100],
    [54, -100],
    [70, -84],
    [70, -66],
    [86, -50],
    [114, -50],
    [130, -66],
    [130, -114],
    [146, -130],
    [162, -130],
    [182, -110],
    [199, -91],
    [200, -60],
    [200, 4],
    [184, 20],
    [126, 20],
    [110, 36],
    [110, 54],
    [94, 70],
    [16, 70],
    [0, 54],
    [0, -60],
  ] as const;
  let i = 0,
    sequence = 0,
    control = { ...controls },
    worst = 0;
  for (let t = 20; t <= 60_000; t += 20) {
    while (i < path.length - 1) {
      const [ax, az] = path[i]!,
        [bx, bz] = path[i + 1]!;
      if (
        (phone.x - ax) * (bx - ax) + (phone.z - az) * (bz - az) > 0 ||
        Math.hypot(ax - phone.x, az - phone.z) < 5
      )
        i++;
      else break;
    }
    const [tx, tz] = path[i]!;
    const want = Math.atan2(tz - phone.z, tx - phone.x);
    const error = Math.atan2(
      Math.sin(want - phone.heading),
      Math.cos(want - phone.heading),
    );
    const speed = Math.hypot(phone.vx, phone.vz);
    // A person-like driver: digital steering, lifting for the corners.
    control = {
      steer: error > 0.06 ? 1 : error < -0.06 ? -1 : 0,
      gas: !(Math.abs(error) > 0.3 && speed > 14) && speed < 24,
      brake: Math.abs(error) > 0.3 && speed > 18,
      drift: false,
    };
    phone = stepDriving(
      { ...phone, courseMs: t - 20 },
      control,
      20,
      profile,
      course.nearbyWalls(phone.x, phone.z, profile.radius + speed * 0.02),
      surfaceSlowdown(course.surfaceAt(phone.x, phone.z)),
      true,
      course.course,
    );
    if (t % 100 === 0) {
      session.input(
        "p",
        {
          raceId: session.race.raceId,
          sequence: ++sequence,
          ...control,
          ...(withPose
            ? {
                pose: {
                  at: t,
                  x: phone.x,
                  z: phone.z,
                  heading: phone.heading,
                  vx: phone.vx,
                  vz: phone.vz,
                },
              }
            : {}),
        },
        t,
      );
      session.tick(t);
      const room = session.race.drivers[0]!;
      worst = Math.max(worst, Math.hypot(room.x - phone.x, room.z - phone.z));
      if (i === path.length - 1) break;
    }
  }
  return { worst, room: session.race.drivers[0]!, finishedPath: i === path.length - 1 };
}

it("keeps the room's copy with the phone all the way round, gates included", () => {
  const synced = drive(true);
  expect(synced.finishedPath).toBe(true);
  // Never more than a tick of travel apart.
  expect(synced.worst).toBeLessThan(4);
  // The room passed every gate in order: it is on its last sector, back at the line.
  expect(synced.room.checkpoint).toBeGreaterThanOrEqual(7);
  // Controls alone, ten times a second, leave the room's copy behind: today it
  // ends up stuck on a barrier after the first gate.
  const unsynced = drive(false);
  expect(unsynced.worst).toBeGreaterThan(20);
  expect(unsynced.room.checkpoint).toBeLessThan(synced.room.checkpoint);
});
