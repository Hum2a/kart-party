import { describe, expect, it } from "vitest";
import {
  RaceSession,
  kartCpuInput,
  kartTickMs,
  type KartTrackId,
} from "@kart-party/game";
import { createSelfPrediction } from "./self-prediction";

const me = "p-device001";

/**
 * The whole device-timed loop with no network: the phone predicts its own kart
 * from the room's seeds, steers it round the track, and reports the finish the
 * room then accepts. A race view without a seed would leave the racer as DNF.
 */
function driveToFinish(trackId: KartTrackId, laps: 1 | 2 | 3) {
  const session = RaceSession.create({
    raceId: `device-${trackId}`,
    players: [{ playerId: me, name: "Phone" }],
    trackId,
    laps,
    cpu: 0,
    items: "off",
  });
  const prediction = createSelfPrediction();
  prediction.running(true, 0);
  prediction.server(session.view(me), 0, 0);
  let sequence = 0;
  let report: ReturnType<typeof prediction.finish>;
  for (let t = 16; t < 240_000 && !report; t += 16) {
    const pose = prediction.pose(t) ?? session.race.drivers[0]!;
    const control = kartCpuInput(
      { x: pose.x, z: pose.z, heading: pose.heading, speed: pose.speed },
      trackId,
      1,
      t,
      0,
    );
    prediction.input(control, t);
    if (t % kartTickMs < 16) {
      const input = { raceId: session.race.raceId, sequence: ++sequence, ...control };
      prediction.published(input, t);
      session.input(me, input, t);
      session.tick(t);
      prediction.server(session.view(me), t, 0);
    }
    report = prediction.finish();
  }
  return { session, report };
}

describe("device-timed finishes", () => {
  it("seeds the phone with its own kart and a rising revision", () => {
    const session = RaceSession.create({
      raceId: "seed",
      players: [{ playerId: me, name: "Phone" }],
      trackId: "party-ring-v1",
      laps: 1,
      cpu: 1,
      items: "off",
    });
    const first = session.view(me).rollback!;
    session.tick(kartTickMs);
    const second = session.view(me).rollback!;
    expect(second.revision).toBeGreaterThan(first.revision);
    expect(second.lap.done).toBe(0);
    // Watchers and CPU karts get no seed.
    expect(session.view(null).rollback).toBeUndefined();
    expect(session.view("cpu-1").rollback).toBeUndefined();
    // A race loaded from storage jumps past revisions phones may already have seen.
    const restored = RaceSession.restore(structuredClone(session.race));
    expect(restored.view(me).rollback!.revision).toBeGreaterThan(second.revision + 1);
  });

  it.each([
    ["party-ring-v1", 1],
    ["parkside-v1", 2],
  ] as const)("lets a phone finish %s and the room accept it", (trackId, laps) => {
    const { session, report } = driveToFinish(trackId, laps);
    expect(report).toBeTruthy();
    expect(report!.lapsMs).toHaveLength(laps);
    expect(session.finish(me, report)).toEqual({ ok: true });
    expect(session.race.drivers[0]!.status).toBe("FINISHED");
    expect(session.race.ended).toBe(true);
  });
});
