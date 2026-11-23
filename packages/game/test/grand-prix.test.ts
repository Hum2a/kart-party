import { describe, expect, it } from "vitest";
import {
  RaceSession,
  classProfile,
  grandPrixDone,
  grandPrixNextTrack,
  grandPrixTable,
  kartCups,
  pointsFor,
  soloDriving,
  stepDriving,
  createDrivingBody,
  kartNeutral,
  parkTrackId,
  type RaceResult,
} from "../src/index.ts";

const row = (
  playerId: string,
  place: number,
  timeMs: number | null = 60_000 + place,
  cpu = false,
): RaceResult => ({ playerId, name: playerId.toUpperCase(), place, timeMs, cpu });

describe("Grand Prix", () => {
  it("scores 15-12-10-8-6-4-2-1 and nothing for a DNF or ninth", () => {
    expect(
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((place) => pointsFor(row("a", place))),
    ).toEqual([15, 12, 10, 8, 6, 4, 2, 1, 0]);
    expect(pointsFor(row("a", 1, null))).toBe(0);
  });

  it("keeps a running table with per-race points and a countback tie-break", () => {
    const races = [
      [row("a", 1), row("b", 2), row("cpu-1", 3, 61_000, true)],
      [row("b", 1), row("a", 2), row("cpu-1", 3, 61_000, true)],
      [row("a", 3), row("b", 3), row("cpu-1", 1, 59_000, true)],
    ];
    const table = grandPrixTable(races);
    // a (1st, 2nd, 3rd) and b (2nd, 1st, 3rd) are level on points and on countback.
    expect(table.map((r) => [r.playerId, r.points, r.place])).toEqual([
      ["a", 37, 1],
      ["b", 37, 1],
      ["cpu-1", 35, 3],
    ]);
    expect(table[0]!.races).toEqual([15, 12, 10]);
    expect(table[2]!.cpu).toBe(true);
  });

  it("breaks a points tie on the most wins", () => {
    // a: 1st (15) + 8th (1) = 16 with a win; b: 3rd (10) + 5th (6) = 16 without one.
    const table = grandPrixTable([
      [row("a", 1), row("b", 3)],
      [row("b", 5), row("a", 8)],
    ]);
    expect(table.map((r) => [r.playerId, r.points, r.place])).toEqual([
      ["a", 16, 1],
      ["b", 16, 2],
    ]);
  });

  it("marks a race a racer missed as null rather than zero", () => {
    const table = grandPrixTable([[row("a", 1)], [row("a", 1), row("late", 2)]]);
    expect(table.find((r) => r.playerId === "late")!.races).toEqual([null, 12]);
  });

  it("walks every cup's tracks in order and then reports it complete", () => {
    for (const cup of kartCups) {
      const state = { cupId: cup.id, races: [] as RaceResult[][] };
      const seen = [];
      while (!grandPrixDone(state)) {
        seen.push(grandPrixNextTrack(state));
        state.races.push([]);
      }
      expect(seen).toEqual([...cup.tracks]);
      expect(grandPrixNextTrack(state)).toBeUndefined();
    }
  });
});

describe("speed classes", () => {
  const topSpeed = (speedClass: "50" | "100" | "150") => {
    let body = createDrivingBody();
    const profile = classProfile(soloDriving, speedClass);
    for (let t = 0; t < 30_000; t += 20)
      body = stepDriving(body, { ...kartNeutral, gas: true }, 20, profile, []);
    return Math.hypot(body.vx, body.vz);
  };

  it("leaves 100 untouched and scales top speed for 50 and 150", () => {
    expect(classProfile(soloDriving, "100")).toBe(soloDriving);
    const [slow, normal, fast] = [topSpeed("50"), topSpeed("100"), topSpeed("150")];
    expect(slow / normal).toBeGreaterThan(0.75);
    expect(slow / normal).toBeLessThan(0.88);
    expect(fast / normal).toBeGreaterThan(1.1);
    expect(fast / normal).toBeLessThan(1.22);
  });

  it("carries the class into the race and its public view", () => {
    const session = RaceSession.create({
      raceId: "r",
      players: [{ playerId: "p-aaaaaaaa", name: "A" }],
      trackId: parkTrackId,
      laps: 1,
      cpu: 1,
      items: "off",
      speedClass: "150",
    });
    expect(session.race.speedClass).toBe("150");
    expect(session.view("p-aaaaaaaa").speedClass).toBe("150");
    const standard = RaceSession.create({
      raceId: "r",
      players: [],
      trackId: parkTrackId,
      laps: 1,
      cpu: 0,
      items: "off",
    });
    expect(standard.race.speedClass).toBeUndefined();
  });
});
