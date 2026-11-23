import { expect, it } from "vitest";
import {
  createGhostRecorder,
  ghostDriver,
  ghostPoseAt,
  ghostSplit,
  kartGhostSchema,
  kartDriverSchema,
  lapDurations,
  RaceSession,
  parkTrackId,
} from "../src/index.ts";

const record = () => {
  const recorder = createGhostRecorder();
  for (let t = 0; t <= 1_000; t += 100)
    recorder.sample(t, { x: t / 100, z: 0, heading: 0 });
  return recorder.finish(
    {
      trackId: parkTrackId,
      laps: 1,
      speedClass: "100",
      timeMs: 1_000,
      lapsMs: [1_000],
    },
    5,
  );
};

it("records one pose per tick and interpolates between them", () => {
  const ghost = record();
  expect(ghost.poses).toHaveLength(33);
  expect(kartGhostSchema.parse(ghost)).toEqual(ghost);
  expect(ghostPoseAt(ghost, 250)).toMatchObject({ x: 2.5, z: 0 });
  expect(ghostPoseAt(ghost, 250)!.speed).toBeCloseTo(10);
  expect(ghostPoseAt(ghost, 1_001)).toBeUndefined();
  expect(ghostPoseAt(ghost, -1)).toBeUndefined();
});

it("ignores repeats and fills a skipped tick so time stays aligned", () => {
  const recorder = createGhostRecorder();
  recorder.sample(0, { x: 0, z: 0, heading: 0 });
  recorder.sample(50, { x: 9, z: 9, heading: 9 });
  recorder.sample(300, { x: 3, z: 0, heading: 0 });
  const ghost = recorder.finish(
    { trackId: parkTrackId, laps: 1, speedClass: "100", timeMs: 300, lapsMs: [300] },
    0,
  );
  expect(ghost.poses).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0]);
});

it("turns the short way round when the heading wraps", () => {
  const recorder = createGhostRecorder();
  recorder.sample(0, { x: 0, z: 0, heading: 3.1 });
  recorder.sample(100, { x: 0, z: 0, heading: -3.1 });
  const ghost = recorder.finish(
    { trackId: parkTrackId, laps: 1, speedClass: "100", timeMs: 100, lapsMs: [100] },
    0,
  );
  expect(Math.abs(ghostPoseAt(ghost, 50)!.heading)).toBeGreaterThan(3.1);
});

it("draws as a valid public driver and reports lap splits", () => {
  const ghost = record();
  expect(kartDriverSchema.parse(ghostDriver(ghost, 500))).toMatchObject({
    playerId: "ghost-best",
    name: "Best run",
  });
  expect(ghostSplit(ghost, 1, 950)).toBe(-50);
  expect(ghostSplit(ghost, 2, 950)).toBeUndefined();
  expect(lapDurations([30_000, 61_000, 90_500])).toEqual([30_000, 31_000, 29_500]);
});

it("replays a real recorded race pose by pose", () => {
  const session = RaceSession.create({
    raceId: "g",
    players: [{ playerId: "p-aaaaaaaa", name: "A" }],
    trackId: parkTrackId,
    laps: 1,
    cpu: 0,
    items: "off",
  });
  const recorder = createGhostRecorder();
  for (let t = 0, seq = 1; t <= 3_000; t += 100, seq++) {
    session.input(
      "p-aaaaaaaa",
      { raceId: "g", sequence: seq, steer: 0, gas: true, brake: false, drift: false },
      t,
    );
    session.tick(t);
    recorder.sample(t, session.race.drivers[0]!);
  }
  const ghost = recorder.finish(
    {
      trackId: parkTrackId,
      laps: 1,
      speedClass: "100",
      timeMs: 3_000,
      lapsMs: [3_000],
    },
    0,
  );
  const self = session.race.drivers[0]!;
  expect(ghostPoseAt(ghost, 3_000)!.x).toBeCloseTo(self.x, 1);
  expect(ghostPoseAt(ghost, 3_000)!.z).toBeCloseTo(self.z, 1);
});
