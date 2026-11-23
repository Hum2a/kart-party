import { expect, it } from "vitest";
import {
  kartTrackCatalogue,
  kartTrackDefinitionSchema,
  kartTrackIds,
  createKartRace,
  reduceKart,
  clearOfWalls,
  ringWalls,
  ringDriving,
  soloDriving,
  polylineTrack,
  polylineTracks,
} from "../src/index.ts";

for (const track of kartTrackCatalogue)
  it(`${track.id}: every grid and recovery slot uses actual clear driving geometry`, () => {
    const race = createKartRace(
      "geometry-check",
      Array.from({ length: 80 }, (_, i) => ({
        playerId: `p${i}`,
        name: `Stand-in ${i}`,
      })),
      { seedGrid: true, trackId: track.id },
    );
    const course = polylineTrack(track.id);
    const radius = course ? soloDriving.radius : ringDriving.radius;
    const positions = new Set<string>();
    for (const driver of race.drivers) {
      expect(
        clearOfWalls(driver.x, driver.z, course?.walls ?? ringWalls, radius),
        `slot ${driver.number} wall clearance`,
      ).toBe(true);
      if (course) expect(course.surfaceAt(driver.x, driver.z)).toBe("road");
      else expect(Math.hypot(driver.x, driver.z)).toBeGreaterThan(34 + radius);
      positions.add(`${driver.x}:${driver.z}`);
      const source = structuredClone(race),
        damaged = source.drivers.find((d) => d.playerId === driver.playerId)!;
      damaged.x = 10000;
      damaged.z = 10000;
      damaged.speed = 10;
      const recovered = reduceKart(source, {
        type: "recover",
        playerId: driver.playerId,
      }).drivers.find((d) => d.playerId === driver.playerId)!;
      expect([
        recovered.x,
        recovered.z,
        recovered.heading,
        recovered.checkpoint,
        recovered.speed,
      ]).toEqual([driver.x, driver.z, driver.heading, 0, 0]);
    }
    expect(positions.size).toBe(80);
  });

it("lists every installed course once, all original", () => {
  expect(kartTrackCatalogue.map((track) => track.id)).toEqual([...kartTrackIds]);
  for (const track of kartTrackCatalogue)
    expect(kartTrackDefinitionSchema.parse(track)).toEqual(track);
  expect(Object.keys(polylineTracks).sort()).toEqual(
    kartTrackIds.filter((id) => id !== "party-ring-v1").sort(),
  );
  expect(JSON.stringify(kartTrackCatalogue)).not.toMatch(/mario|imported/i);
});

for (const [id, course] of Object.entries(polylineTracks))
  it(`${id}: the centreline, item boxes and features stay on clear road`, () => {
    for (let sector = 0; sector < 32; sector++) {
      const pose = course.route.point((course.route.lapLength * sector) / 32);
      expect(course.surfaceAt(pose.x, pose.z), `sector ${sector}`).toBe("road");
      expect(clearOfWalls(pose.x, pose.z, course.walls, 0.85)).toBe(true);
    }
    for (const box of course.itemBoxes)
      expect(course.surfaceAt(box.x, box.z), box.id).toBe("road");
    for (const feature of course.course)
      expect(course.surfaceAt(feature.x, feature.z), feature.id).toBe("road");
  });
